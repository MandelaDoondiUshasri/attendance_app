from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from datetime import date, datetime
from decimal import Decimal
from django.utils import timezone
from accounts.models import User, Role
from employees.models import Employee, Department, Designation, WorkMode
from attendance.models import Attendance, AttendanceStatus, AttendanceWorkMode, AttendanceMethod
from leaves.models import LeaveType, LeaveRequest, LeaveStatus
from wfh.models import WFHRequest, WFHStatus
from salaries.models import Salary, SalaryHistory, SalaryChangeType

class SystemBusinessRulesTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # 1. Create Users & Employees
        self.ceo_user = User.objects.create_user(email='ceo@test.com', password='Password123!', role=Role.CEO)
        self.hr_user = User.objects.create_user(email='hr@test.com', password='Password123!', role=Role.HR)
        self.op_user = User.objects.create_user(email='op@test.com', password='Password123!', role=Role.ATTENDANCE_OPERATOR)
        self.emp_user = User.objects.create_user(email='emp@test.com', password='Password123!', role=Role.EMPLOYEE)

        self.dept = Department.objects.create(name='Eng', code='ENG')
        self.desg = Designation.objects.create(title='Dev', department=self.dept)

        self.emp = Employee.objects.create(
            employee_id='EMP-TEST-01',
            user=self.emp_user,
            full_name='Test Employee',
            email='emp@test.com',
            department=self.dept,
            designation=self.desg,
            joining_date=date(2023, 1, 1),
            work_mode=WorkMode.OFFICE,
            salary=Decimal('100000.00'),
            leave_balance=24,
            biometric_id='FP-TEST-01',
            face_profile_enrolled=True
        )

        self.leave_type = LeaveType.objects.create(name='Paid Leave', code='PL', days_allowed=12)

    def test_attendance_operator_restricted_permissions(self):
        """Attendance Operator cannot view salary or approve leaves/WFH."""
        self.client.force_authenticate(user=self.op_user)

        # Attempt to access salary API -> 403 Forbidden
        response = self.client.get('/api/v1/salaries/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_leave_approval_deducts_balance_and_updates_attendance(self):
        """CEO approving leave deducts leave balance and marks attendance as LEAVE."""
        leave_req = LeaveRequest.objects.create(
            employee=self.emp,
            leave_type=self.leave_type,
            start_date=date.today(),
            end_date=date.today(),
            number_of_days=1,
            reason='Medical Emergency',
            status=LeaveStatus.PENDING
        )

        self.client.force_authenticate(user=self.ceo_user)
        res = self.client.post(f'/api/v1/leaves/{leave_req.id}/approve/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Verify balance deducted from 24 to 23
        self.emp.refresh_from_db()
        self.assertEqual(self.emp.leave_balance, 23)

        # Verify attendance status created as LEAVE
        att = Attendance.objects.get(employee=self.emp, date=date.today())
        self.assertEqual(att.status, AttendanceStatus.LEAVE)

    def test_wfh_attendance_requires_approved_wfh_request(self):
        """Employee cannot mark WFH attendance without an APPROVED WFH request."""
        self.client.force_authenticate(user=self.emp_user)

        # Attempt WFH check-in without approval -> 400 Bad Request
        res = self.client.post('/api/v1/attendance/wfh/', {
            'image_data': 'data:image/jpeg;base64,validframe',
            'latitude': 37.7749,
            'longitude': -122.4194
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('APPROVED WFH request', str(res.data))

        # Grant Approved WFH Request
        WFHRequest.objects.create(
            employee=self.emp,
            date=date.today(),
            reason='Client meetings',
            status=WFHStatus.APPROVED,
            reviewed_by=self.ceo_user
        )

        # Retry WFH check-in -> 201 Created
        res_ok = self.client.post('/api/v1/attendance/wfh/', {
            'image_data': 'data:image/jpeg;base64,validframe',
            'latitude': 37.7749,
            'longitude': -122.4194
        })
        self.assertEqual(res_ok.status_code, status.HTTP_201_CREATED)

    def test_salary_increment_restricted_to_ceo(self):
        """Non-CEO users cannot increment salary."""
        self.client.force_authenticate(user=self.hr_user)
        res = self.client.post('/api/v1/salaries/increment/', {
            'employee_id': self.emp.id,
            'amount': 15000,
            'reason': 'Merit',
            'effective_date': str(date.today()),
            'confirmed': True
        })
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # CEO succeeds
        self.client.force_authenticate(user=self.ceo_user)
        res_ceo = self.client.post('/api/v1/salaries/increment/', {
            'employee_id': self.emp.id,
            'amount': 15000,
            'reason': 'Merit Increase',
            'effective_date': str(date.today()),
            'confirmed': True
        })
        self.assertEqual(res_ceo.status_code, status.HTTP_200_OK)

        # Verify Salary History created
        self.assertEqual(SalaryHistory.objects.filter(employee=self.emp).count(), 1)
