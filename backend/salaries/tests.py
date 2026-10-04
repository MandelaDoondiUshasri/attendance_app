from django.test import TestCase
from django.utils import timezone
from datetime import date
from decimal import Decimal
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import User, Role
from employees.models import Employee, Department, Designation, EmploymentStatus
from salaries.models import Payslip, PayslipStatus
from core.models import OrganizationSettings
from notifications.models import Notification, NotificationType
from audit.models import AuditLog


class PayslipWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Users
        self.ceo_user = User.objects.create_user(
            email='ceo_test@example.com',
            username='ceo_test',
            password='Password123!',
            role=Role.CEO
        )
        self.hr_user = User.objects.create_user(
            email='hr_test@example.com',
            username='hr_test',
            password='Password123!',
            role=Role.HR
        )
        self.emp1_user = User.objects.create_user(
            email='emp1@example.com',
            username='emp1_user',
            password='Password123!',
            role=Role.EMPLOYEE
        )
        self.emp2_user = User.objects.create_user(
            email='emp2@example.com',
            username='emp2_user',
            password='Password123!',
            role=Role.EMPLOYEE
        )

        # Department & Designation
        self.dept = Department.objects.create(name='Tech')
        self.desg = Designation.objects.create(title='Software Engineer', department=self.dept)

        # Employees
        self.emp1 = Employee.objects.create(
            user=self.emp1_user,
            employee_id='EMP-001',
            full_name='Alice Smith',
            email=self.emp1_user.email,
            department=self.dept,
            designation=self.desg,
            joining_date=date(2026, 1, 1),
            employment_status=EmploymentStatus.ACTIVE,
            salary=Decimal('31000.00') # in 31-day month => 1000/day
        )
        self.emp2 = Employee.objects.create(
            user=self.emp2_user,
            employee_id='EMP-002',
            full_name='Bob Jones',
            email=self.emp2_user.email,
            department=self.dept,
            designation=self.desg,
            joining_date=date(2026, 1, 1),
            employment_status=EmploymentStatus.ACTIVE,
            salary=Decimal('45000.00')
        )

        # Settings
        OrganizationSettings.objects.get_or_create(id=1, defaults={
            'company_name': 'Acme Enterprise',
            'company_address': '123 Business Park, City',
            'contact_email': 'hr@acme.com',
            'contact_phone': '+91 9876543210',
            'standard_daily_work_hours': 8.0,
            'half_day_threshold_hours': 4.0
        })

    def test_hr_can_generate_payslip(self):
        """HR can generate a payslip for an employee for a specific month/year."""
        self.client.force_authenticate(user=self.hr_user)
        response = self.client.post('/api/v1/salaries/payslips/generate/', {
            'employee_id': self.emp1.id,
            'year': 2026,
            'month': 10
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], PayslipStatus.GENERATED)
        self.assertEqual(response.data['employee'], self.emp1.id)
        self.assertTrue('PAY-2026-10-EMP-001' in response.data['payslip_reference'])

        # Verify database record
        payslip = Payslip.objects.get(id=response.data['id'])
        self.assertEqual(payslip.status, PayslipStatus.GENERATED)
        self.assertIsNotNone(payslip.pdf_file)
        self.assertTrue(payslip.pdf_file.name.endswith('.pdf'))

        # Verify audit log
        audit = AuditLog.objects.filter(action='PAYSLIP_GENERATED', target_id=str(payslip.id)).first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.actor, self.hr_user)

    def test_payslip_verification_and_release_workflow(self):
        """Full lifecycle: Generate -> Verify -> Release."""
        self.client.force_authenticate(user=self.ceo_user)

        # 1. Generate
        gen_res = self.client.post('/api/v1/salaries/payslips/generate/', {
            'employee_id': self.emp1.id,
            'year': 2026,
            'month': 10
        }, format='json')
        payslip_id = gen_res.data['id']

        # 2. Verify
        ver_res = self.client.post(f'/api/v1/salaries/payslips/{payslip_id}/verify/')
        self.assertEqual(ver_res.status_code, status.HTTP_200_OK)
        self.assertEqual(ver_res.data['status'], PayslipStatus.VERIFIED)
        payslip = Payslip.objects.get(id=payslip_id)
        self.assertEqual(payslip.status, PayslipStatus.VERIFIED)
        self.assertEqual(payslip.verified_by, self.ceo_user)

        # 3. Release
        rel_res = self.client.post(f'/api/v1/salaries/payslips/{payslip_id}/release/')
        self.assertEqual(rel_res.status_code, status.HTTP_200_OK)
        self.assertEqual(rel_res.data['status'], PayslipStatus.RELEASED)
        payslip.refresh_from_db()
        self.assertEqual(payslip.status, PayslipStatus.RELEASED)
        self.assertEqual(payslip.released_by, self.ceo_user)
        self.assertIsNotNone(payslip.released_at)

        # Notification created for employee
        notif = Notification.objects.filter(
            recipient=self.emp1_user,
            notification_type=NotificationType.PAYSLIP_RELEASED
        ).first()
        self.assertIsNotNone(notif)
        self.assertIn("October 2026", notif.message)

    def test_employee_cannot_see_unreleased_payslip(self):
        """CRITICAL: Employee must NOT see DRAFT, GENERATED, or VERIFIED payslips."""
        # Generate and verify payslip
        self.client.force_authenticate(user=self.hr_user)
        gen_res = self.client.post('/api/v1/salaries/payslips/generate/', {
            'employee_id': self.emp1.id,
            'year': 2026,
            'month': 10
        }, format='json')
        payslip_id = gen_res.data['id']

        # Verify it
        self.client.post(f'/api/v1/salaries/payslips/{payslip_id}/verify/')

        # Now authenticate as Employee 1
        self.client.force_authenticate(user=self.emp1_user)

        # Employee calls my-payslips list
        list_res = self.client.get('/api/v1/salaries/my-payslips/')
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        results = list_res.data.get('results', list_res.data)
        # MUST BE EMPTY because status is VERIFIED, not RELEASED!
        self.assertEqual(len(results), 0)

        # Direct download attempt of unreleased payslip
        dl_res = self.client.get(f'/api/v1/salaries/my-payslips/{payslip_id}/download/')
        self.assertEqual(dl_res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("not been released", dl_res.data['error'])

    def test_employee_can_view_and_download_released_payslip(self):
        """Employee can see and download payslip only after release."""
        # Generate & release
        self.client.force_authenticate(user=self.hr_user)
        gen_res = self.client.post('/api/v1/salaries/payslips/generate/', {
            'employee_id': self.emp1.id,
            'year': 2026,
            'month': 10
        }, format='json')
        payslip_id = gen_res.data['id']
        self.client.post(f'/api/v1/salaries/payslips/{payslip_id}/release/')

        # Authenticate as Employee 1
        self.client.force_authenticate(user=self.emp1_user)

        # List my-payslips
        list_res = self.client.get('/api/v1/salaries/my-payslips/')
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        results = list_res.data.get('results', list_res.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], payslip_id)
        self.assertEqual(results[0]['status'], PayslipStatus.RELEASED)

        # Download PDF
        dl_res = self.client.get(f'/api/v1/salaries/my-payslips/{payslip_id}/download/')
        self.assertEqual(dl_res.status_code, status.HTTP_200_OK)
        self.assertEqual(dl_res['Content-Type'], 'application/pdf')
        self.assertTrue(len(dl_res.content) > 100)
        self.assertTrue(dl_res.content.startswith(b'%PDF'))

    def test_employee_cannot_access_another_employees_payslip(self):
        """Employee B must NEVER access Employee A's payslip, even if released."""
        # Generate and release for Employee 1
        self.client.force_authenticate(user=self.hr_user)
        gen_res = self.client.post('/api/v1/salaries/payslips/generate/', {
            'employee_id': self.emp1.id,
            'year': 2026,
            'month': 10
        }, format='json')
        payslip1_id = gen_res.data['id']
        self.client.post(f'/api/v1/salaries/payslips/{payslip1_id}/release/')

        # Authenticate as Employee 2
        self.client.force_authenticate(user=self.emp2_user)

        # Employee 2 checks my-payslips list
        list_res = self.client.get('/api/v1/salaries/my-payslips/')
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        results = list_res.data.get('results', list_res.data)
        self.assertEqual(len(results), 0)

        # Employee 2 tries to download Employee 1's payslip directly
        dl_res = self.client.get(f'/api/v1/salaries/my-payslips/{payslip1_id}/download/')
        self.assertEqual(dl_res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("belonging to another employee", dl_res.data['error'])

    def test_employee_cannot_modify_or_release_payslips(self):
        """Regular employees have no permission to call management endpoints."""
        self.client.force_authenticate(user=self.emp1_user)

        # Attempt to list management payslips
        res1 = self.client.get('/api/v1/salaries/payslips/')
        self.assertEqual(res1.status_code, status.HTTP_403_FORBIDDEN)

        # Attempt to generate
        res2 = self.client.post('/api/v1/salaries/payslips/generate/', {
            'employee_id': self.emp1.id,
            'year': 2026,
            'month': 10
        })
        self.assertEqual(res2.status_code, status.HTTP_403_FORBIDDEN)

    def test_payslip_revocation(self):
        """HR/CEO can revoke a released payslip, hiding it from employee immediately."""
        self.client.force_authenticate(user=self.hr_user)
        gen_res = self.client.post('/api/v1/salaries/payslips/generate/', {
            'employee_id': self.emp1.id,
            'year': 2026,
            'month': 10
        }, format='json')
        payslip_id = gen_res.data['id']
        self.client.post(f'/api/v1/salaries/payslips/{payslip_id}/release/')

        # Revoke with reason
        rev_res = self.client.post(f'/api/v1/salaries/payslips/{payslip_id}/revoke/', {
            'reason': 'Correction of attendance records required'
        }, format='json')
        self.assertEqual(rev_res.status_code, status.HTTP_200_OK)
        self.assertEqual(rev_res.data['status'], PayslipStatus.REVOKED)

        # Verify employee can no longer see it
        self.client.force_authenticate(user=self.emp1_user)
        list_res = self.client.get('/api/v1/salaries/my-payslips/')
        results = list_res.data.get('results', list_res.data)
        self.assertEqual(len(results), 0)

    def test_payslip_versioning_on_regeneration(self):
        """Regenerating an already released payslip creates a new revision version."""
        self.client.force_authenticate(user=self.hr_user)
        gen_res = self.client.post('/api/v1/salaries/payslips/generate/', {
            'employee_id': self.emp1.id,
            'year': 2026,
            'month': 10
        }, format='json')
        payslip1_id = gen_res.data['id']
        self.client.post(f'/api/v1/salaries/payslips/{payslip1_id}/release/')

        # Attempt regenerate without force_version -> should error
        err_res = self.client.post('/api/v1/salaries/payslips/generate/', {
            'employee_id': self.emp1.id,
            'year': 2026,
            'month': 10
        }, format='json')
        self.assertEqual(err_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already RELEASED", err_res.data['error'])

        # Regenerate with force_version=True -> creates V2
        v2_res = self.client.post('/api/v1/salaries/payslips/generate/', {
            'employee_id': self.emp1.id,
            'year': 2026,
            'month': 10,
            'force_version': True
        }, format='json')
        self.assertEqual(v2_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(v2_res.data['version'], 2)
        self.assertIn("-V2", v2_res.data['payslip_reference'])
