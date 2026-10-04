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
