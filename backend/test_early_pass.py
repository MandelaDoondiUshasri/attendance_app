import os
import django
from datetime import date, datetime, time, timedelta
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from employees.models import Employee, Department, EmploymentStatus
from attendance.models import Attendance, AttendanceStatus, AttendanceWorkMode, EarlyPassRequest, EarlyPassStatus, EarlyPassAuditLog
from attendance.services import AttendanceEngine
from core.models import OrganizationSettings, EarlyPassApprovalRole
from reports.services import MonthlyAttendanceSalaryEngine

User = get_user_model()

class EarlyPassFeatureTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.settings = OrganizationSettings.get_settings()
        self.settings.required_working_hours = Decimal('8.00')
        self.settings.half_day_threshold_hours = Decimal('4.00')
        self.settings.early_pass_min_working_hours = Decimal('4.00')
        self.settings.early_pass_max_per_month = 3
        self.settings.early_pass_allow_same_day = True
        self.settings.early_pass_allow_cancellation = True
        self.settings.early_pass_approval_role = EarlyPassApprovalRole.HR_OR_CEO
        self.settings.save()

        self.dept = Department.objects.create(name="Engineering")

        # Create CEO User
        self.ceo_user = User.objects.create_user(
            email='ceo@test.com',
            password='password123',
            role='CEO',
            first_name='CEO',
            last_name='Boss'
        )

        # Create HR User
        self.hr_user = User.objects.create_user(
            email='hr@test.com',
            password='password123',
            role='HR',
            first_name='HR',
            last_name='Manager'
        )

        # Create Employee User & Profile
        self.emp_user = User.objects.create_user(
            email='emp@test.com',
            password='password123',
            role='EMPLOYEE',
            first_name='John',
            last_name='Doe'
        )
        self.employee = Employee.objects.create(
            user=self.emp_user,
            employee_id='EMP1001',
            full_name='John Doe',
            email='emp@test.com',
            department=self.dept,
            salary=Decimal('60000.00'),
            employment_status=EmploymentStatus.ACTIVE,
            joining_date=date(2026, 1, 1)
        )

    def test_scenario_1_approved_early_pass_prevents_salary_deduction(self):
        """
        Scenario 1: 8h requirement, employee works 6 hours (leaves early), EarlyPass is approved.
        Result: Attendance is Present - Approved Early Exit, actual hours = 6.00h, salary deduction = 0.
        """
        req_date = date(2026, 10, 5)
        check_in = timezone.make_aware(datetime.combine(req_date, time(9, 0)))
        check_out = timezone.make_aware(datetime.combine(req_date, time(15, 0))) # 6 hours

        # Create EarlyPass
        early_pass = EarlyPassRequest.objects.create(
            employee=self.employee,
            request_date=req_date,
            check_in_time=check_in,
            requested_exit_time=check_out,
            required_hours=Decimal('8.00'),
            actual_working_hours=Decimal('6.00'),
            missing_hours=Decimal('2.00'),
            reason="Medical appointment",
            status=EarlyPassStatus.APPROVED,
            approved_by=self.hr_user,
            approved_at=timezone.now(),
            approval_remarks="Approved for medical care."
        )

        # Create attendance record
        att = Attendance.objects.create(
            employee=self.employee,
            date=req_date,
            check_in=check_in,
            check_out=check_out,
            working_hours=Decimal('6.00'),
            status=AttendanceStatus.PRESENT
        )
        early_pass.attendance = att
        early_pass.save()

        # Final status calculation
        final_status = AttendanceEngine.calculate_final_status(att)
        self.assertEqual(final_status, AttendanceStatus.PRESENT)

        # Verify Display status
        self.assertEqual(att.get_display_status(), 'Present – Approved Early Exit')
        self.assertEqual(float(att.working_hours), 6.00) # Actual hours preserved!

        # Verify Payroll calculation via MonthlyAttendanceSalaryEngine
        report = MonthlyAttendanceSalaryEngine.calculate_employee_monthly_report(self.employee, 2026, 10)
        day_entry = next((d for d in report['daily_breakdown'] if d['date'] == req_date.isoformat()), None)
        self.assertIsNotNone(day_entry)
        self.assertEqual(day_entry['attendance_status'], 'Present – Approved Early Exit')
        self.assertEqual(day_entry['paid_unpaid'], 'Paid')
        self.assertEqual(day_entry['working_hours'], 6.00) # Preserves 6.0h
        # Check that this approved EarlyPass day is Paid with 0 salary deduction for that day
        self.assertEqual(day_entry['paid_unpaid'], 'Paid')
        self.assertEqual(day_entry['attendance_status'], 'Present – Approved Early Exit')
        self.assertTrue(day_entry['early_pass']['salary_deduction_waived'])

    def test_scenario_2_rejected_early_pass_follows_normal_rules(self):
        """
        Scenario 2: 8h requirement, employee works 6 hours, EarlyPass is rejected.
        Result: Normal attendance/payroll rules apply (receives HALF_DAY, 0.5 unpaid deduction).
        """
        req_date = date(2026, 10, 6)
        check_in = timezone.make_aware(datetime.combine(req_date, time(9, 0)))
        check_out = timezone.make_aware(datetime.combine(req_date, time(15, 0))) # 6 hours

        # Create Rejected EarlyPass
        early_pass = EarlyPassRequest.objects.create(
            employee=self.employee,
            request_date=req_date,
            check_in_time=check_in,
            requested_exit_time=check_out,
            required_hours=Decimal('8.00'),
            actual_working_hours=Decimal('6.00'),
            missing_hours=Decimal('2.00'),
            reason="Want to go shopping",
            status=EarlyPassStatus.REJECTED,
            rejected_by=self.hr_user,
            rejected_at=timezone.now(),
            approval_remarks="Non-critical reason."
        )

        att = Attendance.objects.create(
            employee=self.employee,
            date=req_date,
            check_in=check_in,
            check_out=check_out,
            working_hours=Decimal('6.00')
        )
        att.status = AttendanceEngine.calculate_final_status(att)
        att.save()

        # Under current policy (date > 2026-09-21), < 8.0h is HALF_DAY
        self.assertEqual(att.status, AttendanceStatus.HALF_DAY)

        # Monthly report should record half day deduction
        report = MonthlyAttendanceSalaryEngine.calculate_employee_monthly_report(self.employee, 2026, 10)
        day_entry = next((d for d in report['daily_breakdown'] if d['date'] == req_date.isoformat()), None)
        self.assertIsNotNone(day_entry)
        self.assertEqual(day_entry['attendance_status'], 'Half Day')
        self.assertEqual(day_entry['paid_unpaid'], 'Half Paid')

    def test_scenario_3_full_8_hours_early_pass_not_required(self):
        """
        Scenario 3: Employee works 8+ hours. EarlyPass should not be allowed / required.
        """
        self.client.force_authenticate(user=self.emp_user)
        req_date = date.today()
        # Requesting 8.5 hours
        res = self.client.post('/api/v1/attendance/early-pass/', {
            'request_date': req_date.isoformat(),
            'requested_exit_time': '17:30', # 9:00 to 17:30 = 8.5h
            'reason': 'Finished early'
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn('EarlyPass is not required', res.data.get('error', ''))

    def test_scenario_4_pending_approval_status(self):
        """
        Scenario 4: Employee submits request, status is PENDING.
        """
        self.client.force_authenticate(user=self.emp_user)
        req_date = date.today()
        res = self.client.post('/api/v1/attendance/early-pass/', {
            'request_date': req_date.isoformat(),
            'requested_exit_time': '15:00', # 9:00 to 15:00 = 6h
            'reason': 'Personal family emergency'
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['status'], 'PENDING')
        self.assertEqual(res.data['display_status'], 'Pending Approval')

    def test_scenario_5_unauthorized_self_approval(self):
        """
        Scenario 5: Employee must not be able to approve their own request, even if they have an admin role.
        """
        # Create an HR user who also has an employee profile
        hr_emp = Employee.objects.create(
            user=self.hr_user,
            employee_id='EMP9999',
            full_name='HR Manager',
            email='hr@test.com',
            department=self.dept,
            salary=Decimal('70000.00'),
            employment_status=EmploymentStatus.ACTIVE,
            joining_date=date(2026, 1, 1)
        )

        ep = EarlyPassRequest.objects.create(
            employee=hr_emp,
            request_date=date.today(),
            requested_exit_time=timezone.now() + timedelta(hours=5),
            required_hours=Decimal('8.00'),
            actual_working_hours=Decimal('5.00'),
            missing_hours=Decimal('3.00'),
            reason="Personal"
        )

        self.client.force_authenticate(user=self.hr_user)
        res = self.client.post(f'/api/v1/attendance/early-pass/{ep.id}/approve/', {'remarks': 'Self approving'})
        self.assertEqual(res.status_code, 403)
        self.assertIn('not permitted to approve their own', res.data.get('error', ''))

    def test_scenario_6_monthly_limit_abuse_prevention(self):
        """
        Scenario 6: Ensure company-configured monthly limit (3 requests) is enforced.
        """
        self.client.force_authenticate(user=self.emp_user)
        today = date.today()

        # Create 3 requests for this month
        for i in range(1, 4):
            EarlyPassRequest.objects.create(
                employee=self.employee,
                request_date=today.replace(day=min(25, 10 + i)),
                requested_exit_time=timezone.now(),
                required_hours=Decimal('8.00'),
                actual_working_hours=Decimal('6.00'),
                missing_hours=Decimal('2.00'),
                reason=f"Request {i}",
                status=EarlyPassStatus.APPROVED
            )

        # 4th request should be rejected by policy
        res = self.client.post('/api/v1/attendance/early-pass/', {
            'request_date': today.replace(day=min(28, 20)).isoformat(),
            'requested_exit_time': '15:00',
            'reason': 'Exceeding limit'
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn('limit of 3 reached', res.data.get('error', ''))

    def test_scenario_7_ceo_approval_and_audit_trail(self):
        """
        Scenario 7: CEO approves EarlyPass, audit trail is recorded.
        """
        ep = EarlyPassRequest.objects.create(
            employee=self.employee,
            request_date=date.today(),
            requested_exit_time=timezone.now(),
            required_hours=Decimal('8.00'),
            actual_working_hours=Decimal('6.00'),
            missing_hours=Decimal('2.00'),
            reason="Urgent offsite meeting"
        )

        self.client.force_authenticate(user=self.ceo_user)
        res = self.client.post(f'/api/v1/attendance/early-pass/{ep.id}/approve/', {
            'remarks': 'Approved by CEO.'
        })
        self.assertEqual(res.status_code, 200)

        ep.refresh_from_db()
        self.assertEqual(ep.status, EarlyPassStatus.APPROVED)
        self.assertEqual(ep.approved_by, self.ceo_user)

        # Check audit trail
        trail = ep.audit_trails.filter(action='APPROVED').first()
        self.assertIsNotNone(trail)
        self.assertEqual(trail.actor, self.ceo_user)
        self.assertEqual(trail.new_status, EarlyPassStatus.APPROVED)
