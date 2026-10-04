from django.test import TestCase
from django.utils import timezone
from datetime import date, timedelta
from decimal import Decimal
from accounts.models import User, Role
from employees.models import Employee, Department, Designation
from leaves.models import LeaveType, LeaveBalance, LeaveRequest, LeaveStatus
from core.models import OrganizationSettings
from reports.services import MonthlyAttendanceSalaryEngine
from rest_framework.test import APIClient

class LossOfPayTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.hr_user = User.objects.create_user(
            email='hr_lop_test@example.com',
            username='hr_lop_test',
            password='TestPassword123!',
            role=Role.HR
        )
        self.emp_user = User.objects.create_user(
            email='emp_lop_test@example.com',
            username='emp_lop_test',
            password='TestPassword123!',
            role=Role.EMPLOYEE
        )
        self.dept = Department.objects.create(name='Engineering')
        self.desg = Designation.objects.create(title='Dev', department=self.dept)

        self.emp = Employee.objects.create(
            user=self.emp_user,
            employee_id='FRG-LOP-01',
            full_name='Test Worker',
            email=self.emp_user.email,
            department=self.dept,
            designation=self.desg,
            joining_date=date(2026, 1, 1),
            leave_balance=12.0,
            salary=Decimal('60000.00')
        )

        self.cl_type = LeaveType.objects.create(
            name='Casual Leave Test',
            code='CL_TEST',
            days_allowed=12,
            is_paid=True
        )
        self.lop_type = LeaveType.objects.get_or_create(
            code='LOP',
            defaults={'name': 'Loss of Pay', 'days_allowed': 0, 'is_paid': False}
        )[0]
        # Ensure is_paid is False
        self.lop_type.is_paid = False
        self.lop_type.save()

        OrganizationSettings.objects.get_or_create(id=1, defaults={
            'standard_daily_work_hours': 8.0,
            'half_day_threshold_hours': 4.0
        })

    def test_loss_of_pay_leave_approval_does_not_deduct_leave_balance(self):
        """Applying and approving Loss of Pay must NOT reduce employee.leave_balance."""
        initial_balance = self.emp.leave_balance # 12.0

        # Create LOP request for 2026-06-03 (Wednesday)
        req = LeaveRequest.objects.create(
            employee=self.emp,
            leave_type=self.lop_type,
            start_date=date(2026, 6, 3),
            end_date=date(2026, 6, 3),
            number_of_days=1.0,
            reason='Family emergency, applying Loss of Pay',
            status=LeaveStatus.PENDING
        )

        self.client.force_authenticate(user=self.hr_user)
        response = self.client.post(f'/api/v1/leaves/requests/{req.id}/approve/')
        self.assertEqual(response.status_code, 200)

        self.emp.refresh_from_db()
        req.refresh_from_db()

        self.assertEqual(req.status, LeaveStatus.APPROVED)
        # Paid leave balance remains untouched!
        self.assertEqual(self.emp.leave_balance, initial_balance)

    def test_paid_leave_approval_deducts_leave_balance(self):
        """Standard paid leave approval DOES reduce employee.leave_balance."""
        initial_balance = self.emp.leave_balance # 12.0

        req = LeaveRequest.objects.create(
            employee=self.emp,
            leave_type=self.cl_type,
            start_date=date(2026, 6, 4),
            end_date=date(2026, 6, 4),
            number_of_days=1.0,
            reason='Casual leave',
            status=LeaveStatus.PENDING
        )

        self.client.force_authenticate(user=self.hr_user)
        response = self.client.post(f'/api/v1/leaves/requests/{req.id}/approve/')
        self.assertEqual(response.status_code, 200)

        self.emp.refresh_from_db()
        req.refresh_from_db()

        self.assertEqual(req.status, LeaveStatus.APPROVED)
        self.assertEqual(self.emp.leave_balance, initial_balance - 1.0)

    def test_monthly_report_loss_of_pay_one_day_salary_deduction(self):
        """Loss of Pay approved day produces exactly 1 day salary deduction in monthly report."""
        # Approve 1 day LOP on Wednesday 2026-06-10
        target_date = date(2026, 6, 10)
        req = LeaveRequest.objects.create(
            employee=self.emp,
            leave_type=self.lop_type,
            start_date=target_date,
            end_date=target_date,
            number_of_days=1.0,
            reason='Unpaid emergency',
            status=LeaveStatus.PENDING
        )

        self.client.force_authenticate(user=self.hr_user)
        self.client.post(f'/api/v1/leaves/requests/{req.id}/approve/')

        report = MonthlyAttendanceSalaryEngine.calculate_employee_monthly_report(self.emp, 2026, 6)

        # In daily breakdown, June 10 must be marked Loss of Pay and Unpaid
        day_10 = next((d for d in report['daily_breakdown'] if d['date'] == target_date.isoformat()), None)
        self.assertIsNotNone(day_10)
        self.assertEqual(day_10['paid_unpaid'], 'Unpaid')
        self.assertIn('Loss of Pay', day_10['attendance_status'])

        # Monthly metrics check
        per_day_sal = Decimal(str(report['per_day_salary']))
        expected_deduction = Decimal(str(report['unpaid_absence_days'])) * per_day_sal
        self.assertAlmostEqual(float(report['salary_deduction']), float(expected_deduction), places=2)
        # Ensure loss_of_pay_used_ytd is tracked in annual leave summary
        self.assertEqual(report['leave_balances']['loss_of_pay_used_ytd'], 1.0)


class CasualLeavePolicyEngineTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.hr_user = User.objects.create_user(
            email='hr_cl_test@example.com',
            username='hr_cl_test',
            password='TestPassword123!',
            role=Role.HR
        )
        self.emp_user = User.objects.create_user(
            email='emp_cl_test@example.com',
            username='emp_cl_test',
            password='TestPassword123!',
            role=Role.EMPLOYEE
        )
        self.dept = Department.objects.create(name='Tech')
        self.desg = Designation.objects.create(title='Software Engineer', department=self.dept)

        self.emp = Employee.objects.create(
            user=self.emp_user,
            employee_id='FRG-CL-01',
            full_name='Alice Developer',
            email=self.emp_user.email,
            department=self.dept,
            designation=self.desg,
            joining_date=date(2026, 1, 1),
            leave_balance=12.0,
            salary=Decimal('62000.00')  # Exactly 62,000 for clean calendar divisions
        )

        self.cl_type = LeaveType.objects.get_or_create(
            code='CL',
            defaults={'name': 'Casual Leave', 'days_allowed': 12, 'is_paid': True}
        )[0]
        self.cl_type.is_paid = True
        self.cl_type.save()

        self.lop_type = LeaveType.objects.get_or_create(
            code='LOP',
            defaults={'name': 'Loss of Pay (LOP)', 'days_allowed': 0, 'is_paid': False}
        )[0]
        self.lop_type.is_paid = False
        self.lop_type.save()

        OrganizationSettings.objects.get_or_create(id=1, defaults={
            'standard_daily_work_hours': 8.0,
            'half_day_threshold_hours': 4.0
        })

    def test_daily_salary_strict_calendar_day_divisor(self):
        """Daily salary must strictly use actual calendar days (28/29/30/31)."""
        from leaves.services import CasualLeavePolicyEngine

        # January: 31 days -> 62000 / 31 = 2000.00
        jan_daily = CasualLeavePolicyEngine.calculate_daily_salary(self.emp, 2026, 1)
        self.assertEqual(jan_daily, Decimal('2000.00'))

        # February 2026: 28 days -> 62000 / 28 = 2214.29
        feb_daily = CasualLeavePolicyEngine.calculate_daily_salary(self.emp, 2026, 2)
        self.assertEqual(feb_daily, Decimal('2214.29'))

        # February 2024 (leap year): 29 days -> 62000 / 29 = 2137.93
        feb_leap_daily = CasualLeavePolicyEngine.calculate_daily_salary(self.emp, 2024, 2)
        self.assertEqual(feb_leap_daily, Decimal('2137.93'))

        # April: 30 days -> 62000 / 30 = 2066.67
        apr_daily = CasualLeavePolicyEngine.calculate_daily_salary(self.emp, 2026, 4)
        self.assertEqual(apr_daily, Decimal('2066.67'))

    def test_dynamic_carry_forward_progression(self):
        """
        Dynamic carry-forward:
        - If unused 1 month -> carry-forward = 1.
        - If unused 2 months -> carry-forward = 2.
        - If unused 3 months -> carry-forward = 3.
        - If unused 6 months -> carry-forward = 6.
        Normal CL allowance = N + 1.
        """
        from leaves.services import CasualLeavePolicyEngine

        # January (Month 1): 0 previous unused CL -> N = 0, allowance = 0 + 1 = 1
        jan = CasualLeavePolicyEngine.calculate_cl_allowance(self.emp, 2026, 1)
        self.assertEqual(jan['previous_unused_cl'], 0.0)
        self.assertEqual(jan['current_month_cl'], 1.0)
        self.assertEqual(jan['normal_cl_allowance'], 1.0)

        # February (Month 2): Unused in Jan -> N = 1, allowance = 1 + 1 = 2
        feb = CasualLeavePolicyEngine.calculate_cl_allowance(self.emp, 2026, 2)
        self.assertEqual(feb['previous_unused_cl'], 1.0)
        self.assertEqual(feb['normal_cl_allowance'], 2.0)

        # April (Month 4): Unused in Jan, Feb, Mar -> N = 3, allowance = 3 + 1 = 4
        apr = CasualLeavePolicyEngine.calculate_cl_allowance(self.emp, 2026, 4)
        self.assertEqual(apr['previous_unused_cl'], 3.0)
        self.assertEqual(apr['normal_cl_allowance'], 4.0)

        # July (Month 7): Unused for 6 months -> N = 6, allowance = 6 + 1 = 7
        jul = CasualLeavePolicyEngine.calculate_cl_allowance(self.emp, 2026, 7)
        self.assertEqual(jul['previous_unused_cl'], 6.0)
        self.assertEqual(jul['normal_cl_allowance'], 7.0)

    def test_split_leave_request_evaluation_exceeding_allowance(self):
        """
        In July, available CL = 7. Employee requests 8 days.
        Request must be split: 7 days CL + 1 additional day requiring higher authority approval.
        Additional day must not be LOP until approved.
        """
        from leaves.services import CasualLeavePolicyEngine
        from leaves.models import AdditionalLeaveStatus

        eval_res = CasualLeavePolicyEngine.evaluate_leave_request(
            employee=self.emp,
            leave_type=self.cl_type,
            start_date=date(2026, 7, 1),
            requested_days=8.0
        )

        self.assertTrue(eval_res['requires_higher_authority'])
        self.assertEqual(eval_res['cl_days'], 7.0)
        self.assertEqual(eval_res['additional_leave_days'], 1.0)
        self.assertEqual(eval_res['additional_leave_status'], AdditionalLeaveStatus.PENDING)
        self.assertEqual(eval_res['lop_days'], 0.0) # Not LOP yet!
        # Expected deduction = 1 day * (62000 / 31) = 2000.00
        self.assertEqual(eval_res['expected_lop_deduction'], Decimal('2000.00'))

    def test_split_leave_approval_as_lop_deducts_salary(self):
        """
        When higher authority approves additional days as LOP:
        - cl_days (7) deducted from CL quota.
        - additional_leave_days (1) becomes LOP and deducts 1 day salary.
        """
        from leaves.models import AdditionalLeaveStatus

        # July 1 to July 9 (8 working days: Jul 1-4, Jul 6-9; Jul 5 is Sunday)
        req = LeaveRequest.objects.create(
            employee=self.emp,
            leave_type=self.cl_type,
            start_date=date(2026, 7, 1),
            end_date=date(2026, 7, 9),
            number_of_days=8.0,
            cl_days=7.0,
            additional_leave_days=1.0,
            additional_leave_status=AdditionalLeaveStatus.PENDING,
            daily_salary_rate=Decimal('2000.00'),
            expected_lop_deduction=Decimal('2000.00'),
            reason='Long travel',
            status=LeaveStatus.PENDING
        )

        initial_quota = self.emp.leave_balance # 12.0

        self.client.force_authenticate(user=self.hr_user)
        # Approve with approve_additional_as_lop = True
        res = self.client.post(f'/api/v1/leaves/requests/{req.id}/approve/', {
            'approve_additional_as_lop': True
        })
        self.assertEqual(res.status_code, 200)

        self.emp.refresh_from_db()
        req.refresh_from_db()

        self.assertEqual(req.status, LeaveStatus.APPROVED)
        self.assertEqual(req.additional_leave_status, AdditionalLeaveStatus.APPROVED)
        self.assertEqual(req.lop_days, 1.0)
        # Only 7 CL days deducted from CL balance (12 - 7 = 5)
        self.assertEqual(self.emp.leave_balance, initial_quota - 7.0)

        # Mark remaining working days of July 2026 as present so only the LOP day is unpaid
        from attendance.models import Attendance, AttendanceStatus
        for d in range(10, 32):
            dt = date(2026, 7, d)
            if dt.weekday() != 6:  # Skip Sundays
                Attendance.objects.create(
                    employee=self.emp,
                    date=dt,
                    check_in=timezone.now(),
                    check_out=timezone.now() + timedelta(hours=8),
                    working_hours=Decimal('8.0'),
                    status=AttendanceStatus.PRESENT
                )

        # Payroll calculation for July 2026
        report = MonthlyAttendanceSalaryEngine.calculate_employee_monthly_report(self.emp, 2026, 7)
        self.assertEqual(report['casual_leave_used'], 7.0)
        self.assertAlmostEqual(float(report['per_day_salary']), 2000.00, places=2)

        # July 9 must be Loss of Pay (Unpaid)
        jul_9 = next((d for d in report['daily_breakdown'] if d['date'] == '2026-07-09'), None)
        self.assertIsNotNone(jul_9)
        self.assertEqual(jul_9['paid_unpaid'], 'Unpaid')
        self.assertIn('Loss of Pay', jul_9['attendance_status'])

        # Exactly 1 day LOP deduction (2000.00)
        self.assertEqual(report['unpaid_absence_days'], 1.0)
        self.assertAlmostEqual(float(report['salary_deduction']), 2000.00, places=2)
        self.assertAlmostEqual(float(report['salary_payable']), 60000.00, places=2)

    def test_split_leave_rejection_of_additional_days_no_salary_deduction(self):
        """
        When higher authority rejects additional days:
        - Only cl_days (7) approved as CL.
        - Additional day rejected, NOT converted to LOP.
        - NO salary deduction occurs.
        """
        from leaves.models import AdditionalLeaveStatus

        req = LeaveRequest.objects.create(
            employee=self.emp,
            leave_type=self.cl_type,
            start_date=date(2026, 7, 1),
            end_date=date(2026, 7, 8),
            number_of_days=8.0,
            cl_days=7.0,
            additional_leave_days=1.0,
            additional_leave_status=AdditionalLeaveStatus.PENDING,
            daily_salary_rate=Decimal('2000.00'),
            expected_lop_deduction=Decimal('2000.00'),
            reason='Long travel',
            status=LeaveStatus.PENDING
        )

        initial_quota = self.emp.leave_balance

        self.client.force_authenticate(user=self.hr_user)
        # Approve CL portion only, reject additional days
        res = self.client.post(f'/api/v1/leaves/requests/{req.id}/approve/', {
            'approve_additional_as_lop': False
        })
        self.assertEqual(res.status_code, 200)

        self.emp.refresh_from_db()
        req.refresh_from_db()

        self.assertEqual(req.status, LeaveStatus.APPROVED)
        self.assertEqual(req.additional_leave_status, AdditionalLeaveStatus.REJECTED)
        self.assertEqual(req.lop_days, 0.0)
        self.assertEqual(req.number_of_days, 7.0) # Reset to cl_days
        self.assertEqual(self.emp.leave_balance, initial_quota - 7.0)

    def test_current_month_cl_lock_after_usage(self):
        """
        Once an employee takes CL in a month:
        - Casual Leave is disabled for that month.
        - Attempting to apply for CL in that month raises validation error.
        - Remaining carry-forward balance safely carries forward to subsequent month.
        """
        from leaves.services import CasualLeavePolicyEngine

        # Use 1 day CL in March 2026
        LeaveRequest.objects.create(
            employee=self.emp,
            leave_type=self.cl_type,
            start_date=date(2026, 3, 5),
            end_date=date(2026, 3, 5),
            number_of_days=1.0,
            cl_days=1.0,
            status=LeaveStatus.APPROVED
        )

        # Check March CL allowance
        mar_allowance = CasualLeavePolicyEngine.calculate_cl_allowance(self.emp, 2026, 3)
        self.assertTrue(mar_allowance['is_cl_disabled'])
        self.assertEqual(mar_allowance['cl_used_current_month'], 1.0)

        # Attempting to apply for CL again in March raises ValueError
        with self.assertRaises(ValueError):
            CasualLeavePolicyEngine.evaluate_leave_request(
                employee=self.emp,
                leave_type=self.cl_type,
                start_date=date(2026, 3, 20),
                requested_days=1.0
            )

        # But in April (Month 4), remaining carry-forward is intact:
        # Months elapsed = 3 (Jan, Feb, Mar). Used in prev months = 1.0.
        # Carry-forward N = 3 - 1 = 2.0.
        # April Normal Allowance = N + 1 = 2.0 + 1.0 = 3.0.
        apr_allowance = CasualLeavePolicyEngine.calculate_cl_allowance(self.emp, 2026, 4)
        self.assertFalse(apr_allowance['is_cl_disabled'])
        self.assertEqual(apr_allowance['previous_unused_cl'], 2.0)
        self.assertEqual(apr_allowance['normal_cl_allowance'], 3.0)
