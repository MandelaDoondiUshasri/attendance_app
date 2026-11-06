from datetime import date, timedelta
from decimal import Decimal
from django.utils import timezone
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import Role
from tenants.models import Company, SubscriptionPlan, CompanySubscription, PlanTier
from tenants.middleware import clear_current_tenant
from employees.models import Department, Designation, Employee, EmploymentStatus
from leaves.models import LeaveType, LeaveRequest, LeaveStatus
from attendance.models import Attendance, AttendanceStatus
from salaries.models import Payslip, PayslipStatus, EmployeeSalary

User = get_user_model()


class EnterpriseSaasSecurityRemediationTestSuite(TestCase):
    """
    Automated security verification and penetration suite testing:
    - Multi-tenant data isolation across all ViewSets.
    - Direct object reference (IDOR) prevention.
    - Bulk payroll execution scoping.
    - Tenant header/query spoofing immunity.
    - Cross-company foreign key injection prevention.
    - Subscription suspension write blocking.
    - Plan headcount limit enforcement.
    - CSV/Excel export tenant scoping.
    """

    def setUp(self):
        clear_current_tenant()
        self.client = APIClient()

        # 1. Master Tenant (FRG Enterprise)
        self.master_tenant = Company.objects.filter(is_master_tenant=True).first()
        if not self.master_tenant:
            self.master_tenant = Company.objects.create(
                name="FRG Enterprise",
                slug="frg",
                contact_email="admin@frg.com",
                status="ACTIVE",
                is_master_tenant=True
            )

        # 2. Subscription Plan
        self.plan = SubscriptionPlan.objects.create(
            name="Professional",
            tier=PlanTier.PROFESSIONAL,
            billing_cycle="MONTHLY",
            price_inr=9999.00,
            max_employees=5,
            max_storage_mb=5000
        )

        # 3. Company Alpha (Tenant A)
        self.company_alpha = Company.objects.create(
            name="Alpha Corp",
            slug="alpha",
            contact_email="admin@alphacorp.com",
            status="ACTIVE"
        )
        self.sub_alpha = CompanySubscription.objects.create(
            company=self.company_alpha,
            plan=self.plan,
            status="ACTIVE",
            start_date=date.today(),
            expiry_date=date.today() + timedelta(days=30),
            grace_period_days=7
        )
        self.admin_alpha = User.objects.create_user(
            email="admin@alphacorp.com",
            username="admin_alpha",
            password="Password123!",
            role=Role.HR,
            company=self.company_alpha
        )
        self.dept_alpha = Department.objects.create(
            company=self.company_alpha,
            name="Alpha Engineering",
            code="ALPHA-ENG"
        )
        self.desig_alpha = Designation.objects.create(
            company=self.company_alpha,
            department=self.dept_alpha,
            title="Software Engineer"
        )
        self.user_emp_alpha = User.objects.create_user(
            email="emp1@alphacorp.com",
            username="emp1_alpha",
            password="Password123!",
            role=Role.EMPLOYEE,
            company=self.company_alpha
        )
        self.emp_alpha = Employee.objects.create(
            company=self.company_alpha,
            user=self.user_emp_alpha,
            employee_id="ALPHA-001",
            full_name="Alice Alpha",
            email="emp1@alphacorp.com",
            department=self.dept_alpha,
            designation=self.desig_alpha,
            joining_date=date.today(),
            employment_status=EmploymentStatus.ACTIVE
        )
        self.salary_alpha = EmployeeSalary.objects.create(
            employee=self.emp_alpha,
            monthly_ctc=Decimal('43000.00'),
            is_active=True
        )

        # 4. Company Beta (Tenant B)
        self.company_beta = Company.objects.create(
            name="Beta Corp",
            slug="beta",
            contact_email="admin@betacorp.com",
            status="ACTIVE"
        )
        self.sub_beta = CompanySubscription.objects.create(
            company=self.company_beta,
            plan=self.plan,
            status="ACTIVE",
            start_date=date.today(),
            expiry_date=date.today() + timedelta(days=30),
            grace_period_days=7
        )
        self.admin_beta = User.objects.create_user(
            email="admin@betacorp.com",
            username="admin_beta",
            password="Password123!",
            role=Role.HR,
            company=self.company_beta
        )
        self.dept_beta = Department.objects.create(
            company=self.company_beta,
            name="Beta Marketing",
            code="BETA-MKT"
        )
        self.desig_beta = Designation.objects.create(
            company=self.company_beta,
            department=self.dept_beta,
            title="Marketing Lead"
        )
        self.user_emp_beta = User.objects.create_user(
            email="emp1@betacorp.com",
            username="emp1_beta",
            password="Password123!",
            role=Role.EMPLOYEE,
            company=self.company_beta
        )
        self.emp_beta = Employee.objects.create(
            company=self.company_beta,
            user=self.user_emp_beta,
            employee_id="BETA-001",
            full_name="Bob Beta",
            email="emp1@betacorp.com",
            department=self.dept_beta,
            designation=self.desig_beta,
            joining_date=date.today(),
            employment_status=EmploymentStatus.ACTIVE
        )
        self.salary_beta = EmployeeSalary.objects.create(
            employee=self.emp_beta,
            monthly_ctc=Decimal('43000.00'),
            is_active=True
        )

        # 5. Leave and Attendance sample records
        self.leave_type_alpha = LeaveType.objects.create(
            company=self.company_alpha,
            name="Casual Leave Alpha",
            code="CLA"
        )
        self.leave_alpha = LeaveRequest.objects.create(
            employee=self.emp_alpha,
            leave_type=self.leave_type_alpha,
            start_date=date.today(),
            end_date=date.today(),
            number_of_days=Decimal('1.0'),
            status=LeaveStatus.APPROVED,
            reason="Alpha Leave"
        )
        self.leave_type_beta = LeaveType.objects.create(
            company=self.company_beta,
            name="Casual Leave Beta",
            code="CLB"
        )
        self.leave_beta = LeaveRequest.objects.create(
            employee=self.emp_beta,
            leave_type=self.leave_type_beta,
            start_date=date.today(),
            end_date=date.today(),
            number_of_days=Decimal('1.0'),
            status=LeaveStatus.APPROVED,
            reason="Beta Leave"
        )

        self.att_alpha = Attendance.objects.create(
            employee=self.emp_alpha,
            date=date.today(),
            check_in=timezone.now(),
            status=AttendanceStatus.PRESENT
        )
        self.att_beta = Attendance.objects.create(
            employee=self.emp_beta,
            date=date.today(),
            check_in=timezone.now(),
            status=AttendanceStatus.PRESENT
        )

        # 6. Payslips
        self.payslip_alpha = Payslip.objects.create(
            payslip_reference=f"PAY-{date.today().year}-{date.today().month:02d}-ALPHA-001",
            employee=self.emp_alpha,
            year=date.today().year,
            month=date.today().month,
            status=PayslipStatus.GENERATED,
            gross_salary=Decimal('40566.04'),
            net_salary=Decimal('35000.00')
        )
        self.payslip_beta = Payslip.objects.create(
            payslip_reference=f"PAY-{date.today().year}-{date.today().month:02d}-BETA-001",
            employee=self.emp_beta,
            year=date.today().year,
            month=date.today().month,
            status=PayslipStatus.GENERATED,
            gross_salary=Decimal('40566.04'),
            net_salary=Decimal('35000.00')
        )

    def tearDown(self):
        clear_current_tenant()

    def test_01_cross_tenant_employee_list_isolation(self):
        """Alpha admin calling /api/v1/employees/ must receive only Alpha employees."""
        self.client.force_authenticate(user=self.admin_alpha)
        response = self.client.get('/api/v1/employees/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        results = data.get('results', data)
        emp_ids = [e['employee_id'] for e in results]
        self.assertIn('ALPHA-001', emp_ids)
        self.assertNotIn('BETA-001', emp_ids)

    def test_02_cross_tenant_employee_idor_prevention(self):
        """Alpha admin calling /api/v1/employees/{beta_id}/ directly must receive 404."""
        self.client.force_authenticate(user=self.admin_alpha)
        response = self.client.get(f'/api/v1/employees/{self.emp_beta.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_03_cross_tenant_leave_isolation(self):
        """Alpha admin calling /api/v1/leaves/requests/ must receive only Alpha leaves."""
        self.client.force_authenticate(user=self.admin_alpha)
        response = self.client.get('/api/v1/leaves/requests/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        results = data.get('results', data)
        reasons = [l['reason'] for l in results]
        self.assertIn('Alpha Leave', reasons)
        self.assertNotIn('Beta Leave', reasons)

    def test_04_cross_tenant_attendance_isolation(self):
        """Alpha admin calling /api/v1/attendance/ must receive only Alpha attendance."""
        self.client.force_authenticate(user=self.admin_alpha)
        response = self.client.get('/api/v1/attendance/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        results = data.get('results', data)
        emp_ids = [a.get('employee_id_code') for a in results]
        self.assertIn('ALPHA-001', emp_ids)
        self.assertNotIn('BETA-001', emp_ids)

    def test_05_cross_tenant_payslip_isolation_and_idor(self):
        """Alpha admin calling payslips must receive only Alpha payslips and 404 on Beta payslip."""
        self.client.force_authenticate(user=self.admin_alpha)
        # List
        response = self.client.get('/api/v1/salaries/payslips/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        results = data.get('results', data)
        payslip_ids = [p['id'] for p in results]
        self.assertIn(self.payslip_alpha.id, payslip_ids)
        self.assertNotIn(self.payslip_beta.id, payslip_ids)

        # IDOR Detail
        response_detail = self.client.get(f'/api/v1/salaries/payslips/{self.payslip_beta.id}/')
        self.assertEqual(response_detail.status_code, status.HTTP_404_NOT_FOUND)

    def test_06_cross_tenant_bulk_payroll_isolation(self):
        """Bulk payroll initiated by Alpha must only generate payslips for Alpha employees."""
        self.client.force_authenticate(user=self.admin_alpha)
        next_month = (date.today().month % 12) + 1
        year = date.today().year + (1 if next_month == 1 else 0)

        response = self.client.post('/api/v1/salaries/payslips/bulk-generate/', {
            'year': year,
            'month': next_month
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify: Alpha has payslip for this month/year, Beta has ZERO
        self.assertTrue(Payslip.objects.filter(employee=self.emp_alpha, year=year, month=next_month).exists())
        self.assertFalse(Payslip.objects.filter(employee=self.emp_beta, year=year, month=next_month).exists())

    def test_07_tenant_header_spoofing_ignored(self):
        """Alpha user sending X-Tenant-Slug='beta' must be strictly restricted to Alpha."""
        self.client.force_authenticate(user=self.admin_alpha)
        response = self.client.get('/api/v1/employees/', HTTP_X_TENANT_SLUG='beta')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        results = data.get('results', data)
        emp_ids = [e['employee_id'] for e in results]
        self.assertIn('ALPHA-001', emp_ids)
        self.assertNotIn('BETA-001', emp_ids)

    def test_08_cross_company_fk_corruption_prevented(self):
        """Alpha admin trying to create employee with Beta's department must be rejected with 400."""
        self.client.force_authenticate(user=self.admin_alpha)
        payload = {
            "full_name": "Eve Injected",
            "email": "eve.injected@alphacorp.com",
            "password": "Password123!",
            "employee_id": "ALPHA-099",
            "department": self.dept_beta.id,  # Foreign department from Beta Corp!
            "designation": self.desig_alpha.id,
            "joining_date": str(date.today()),
            "salary": "40000.00"
        }
        response = self.client.post('/api/v1/employees/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_09_suspended_tenant_write_blocked(self):
        """Suspended tenant must be blocked from write actions with 403, but read actions succeed."""
        company_gamma = Company.objects.create(
            name="Gamma Corp",
            slug="gamma",
            contact_email="admin@gamma.com",
            status="SUSPENDED"
        )
        admin_gamma = User.objects.create_user(
            email="admin@gamma.com",
            username="admin_gamma",
            password="Password123!",
            role=Role.COMPANY_ADMIN,
            company=company_gamma
        )
        self.client.force_authenticate(user=admin_gamma)

        # Write attempt -> 403
        response_post = self.client.post('/api/v1/employees/departments/', {
            "name": "Gamma IT",
            "code": "GIT"
        }, format='json')
        self.assertEqual(response_post.status_code, status.HTTP_403_FORBIDDEN)

        # Read attempt -> 200
        response_get = self.client.get('/api/v1/employees/departments/')
        self.assertEqual(response_get.status_code, status.HTTP_200_OK)

    def test_10_headcount_ceiling_enforced(self):
        """Attempting to add employees beyond plan max_employees must be rejected with 400."""
        # Set Alpha's plan limit to 1 (Alpha already has 1 employee)
        self.plan.max_employees = 1
        self.plan.save()

        self.client.force_authenticate(user=self.admin_alpha)
        payload = {
            "full_name": "Charlie Excess",
            "email": "charlie@alphacorp.com",
            "password": "Password123!",
            "employee_id": "ALPHA-002",
            "department": self.dept_alpha.id,
            "designation": self.desig_alpha.id,
            "joining_date": str(date.today()),
            "salary": "40000.00"
        }
        response = self.client.post('/api/v1/employees/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        error_msg = str(response.json()).lower()
        self.assertTrue("headcount" in error_msg or "quota" in error_msg or "limit" in error_msg)

    def test_11_csv_export_isolation(self):
        """Exporting employee CSV must return only employees belonging to the requesting tenant."""
        self.client.force_authenticate(user=self.admin_alpha)
        response = self.client.get('/api/v1/reports/export-employees/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        content = response.content.decode('utf-8')
        self.assertIn('ALPHA-001', content)
        self.assertNotIn('BETA-001', content)
