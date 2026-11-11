import uuid
from datetime import date, timedelta, time, datetime
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from tenants.models import Company, CompanyStatus
from accounts.models import Role
from employees.models import Employee, Department, Designation
from attendance.models import Attendance, AttendanceStatus, AttendanceWorkMode, AttendanceMethod, EarlyPassRequest, EarlyPassStatus, AttendanceCorrectionRequest
from leaves.models import LeaveType, LeaveRequest, LeaveStatus
from wfh.models import WFHRequest, WFHStatus
from notifications.models import Notification, NotificationType
from notifications.services import WebPushSender
from core.models import OrganizationSettings

User = get_user_model()


class CEONotificationTestSuite(TestCase):
    def setUp(self):
        super().setUp()
        WebPushSender.reset_mock_handler()

        # Company 1: First Care Pharmacy (Child Tenant)
        self.fcp_company, _ = Company.objects.get_or_create(
            slug='first-care-pharmacy',
            defaults={
                'name': 'First Care Pharmacy',
                'contact_email': 'ceo@firstcare.com',
                'status': CompanyStatus.ACTIVE,
                'is_master_tenant': False
            }
        )

        # Company 2: Fortune Rise Group (Master Tenant)
        self.frg_company = Company.objects.filter(slug='frg').first()
        if not self.frg_company:
            self.frg_company = Company.objects.filter(is_master_tenant=True).first()
        if not self.frg_company:
            self.frg_company = Company.objects.create(
                name='Fortune Rise Group',
                slug='frg',
                contact_email='ceo@fortunerise.com',
                status=CompanyStatus.ACTIVE,
                is_master_tenant=True
            )

        # FCP CEO & Employee
        self.fcp_ceo = User.objects.create_user(
            email='test_fcp_ceo@firstcare.com',
            username='test_fcp_ceo',
            password='password123',
            role=Role.CEO,
            company=self.fcp_company
        )
        self.fcp_emp_user = User.objects.create_user(
            email='test_fcp_worker@firstcare.com',
            username='test_fcp_worker',
            password='password123',
            role=Role.EMPLOYEE,
            company=self.fcp_company
        )
        self.fcp_employee = Employee.objects.create(
            user=self.fcp_emp_user,
            employee_id='TEST-FCP-001',
            full_name='FCP Pharmacist',
            email=self.fcp_emp_user.email,
            company=self.fcp_company,
            joining_date=date(2025, 1, 1)
        )

        # FRG CEO & Employee
        self.frg_ceo = User.objects.create_user(
            email='test_frg_ceo@fortunerise.com',
            username='test_frg_ceo',
            password='password123',
            role=Role.CEO,
            company=self.frg_company
        )
        self.frg_emp_user = User.objects.create_user(
            email='test_frg_worker@fortunerise.com',
            username='test_frg_worker',
            password='password123',
            role=Role.EMPLOYEE,
            company=self.frg_company
        )
        self.frg_employee = Employee.objects.create(
            user=self.frg_emp_user,
            employee_id='TEST-FRG-001',
            full_name='FRG Engineer',
            email=self.frg_emp_user.email,
            company=self.frg_company,
            joining_date=date(2025, 1, 1)
        )

        self.client = APIClient()

    def tearDown(self):
        WebPushSender.reset_mock_handler()
        super().tearDown()

    def test_clock_in_notifies_company_ceo_with_tenant_isolation(self):
        """FCP employee clock-in notifies FCP CEO, never FRG CEO."""
        self.client.force_authenticate(user=self.fcp_emp_user)
        res = self.client.post('/api/v1/attendance/clock-in/')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # Verify FCP CEO received notification
        fcp_notifs = Notification.objects.filter(
            recipient=self.fcp_ceo,
            notification_type=NotificationType.ATTENDANCE_CLOCK_IN
        )
        self.assertEqual(fcp_notifs.count(), 1)
        notif = fcp_notifs.first()
        self.assertIn("FCP Pharmacist", notif.message)
        self.assertIn("TEST-FCP-001", notif.message)
        self.assertEqual(notif.payload.get("route"), "/attendance")

        # Verify FRG CEO received zero notifications (strict isolation)
        frg_notifs = Notification.objects.filter(
            recipient=self.frg_ceo,
            notification_type=NotificationType.ATTENDANCE_CLOCK_IN
        )
        self.assertEqual(frg_notifs.count(), 0)

    def test_clock_out_notifies_company_ceo_with_tenant_isolation(self):
        """FCP employee clock-out notifies FCP CEO with working hours."""
        today = timezone.localdate()
        att = Attendance.objects.create(
            employee=self.fcp_employee,
            date=today,
            check_in=timezone.now() - timedelta(hours=8),
            status=AttendanceStatus.PRESENT,
            work_mode=AttendanceWorkMode.OFFICE,
            attendance_method=AttendanceMethod.WEB_PORTAL
        )

        self.client.force_authenticate(user=self.fcp_emp_user)
        res = self.client.post('/api/v1/attendance/clock-out/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Verify FCP CEO received clock-out notification
        fcp_notifs = Notification.objects.filter(
            recipient=self.fcp_ceo,
            notification_type=NotificationType.ATTENDANCE_CLOCK_OUT
        )
        self.assertEqual(fcp_notifs.count(), 1)
        notif = fcp_notifs.first()
        self.assertIn("FCP Pharmacist", notif.message)
        self.assertIn("clocked out", notif.message)

        # Verify FRG CEO received zero notifications
        frg_notifs = Notification.objects.filter(
            recipient=self.frg_ceo,
            notification_type=NotificationType.ATTENDANCE_CLOCK_OUT
        )
        self.assertEqual(frg_notifs.count(), 0)

    def test_wfh_attendance_notifies_company_ceo(self):
        """WFH check-in and check-out notifies company CEO."""
        today = timezone.localdate()
        # Approve WFH for today
        WFHRequest.objects.create(
            employee=self.fcp_employee,
            start_date=today,
            end_date=today,
            reason="WFH testing",
            status=WFHStatus.APPROVED
        )

        self.client.force_authenticate(user=self.fcp_emp_user)
        # Check-in
        res = self.client.post('/api/v1/attendance/wfh/', {
            'latitude': 17.3850,
            'longitude': 78.4867,
            'device_id': 'TEST-DEV'
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        fcp_in = Notification.objects.filter(
            recipient=self.fcp_ceo,
            notification_type=NotificationType.ATTENDANCE_CLOCK_IN
        )
        self.assertEqual(fcp_in.count(), 1)
        self.assertIn("WFH", fcp_in.first().message)

        # Check-out
        res2 = self.client.post('/api/v1/attendance/wfh/', {
            'latitude': 17.3850,
            'longitude': 78.4867,
            'device_id': 'TEST-DEV'
        })
        self.assertEqual(res2.status_code, status.HTTP_200_OK)

        fcp_out = Notification.objects.filter(
            recipient=self.fcp_ceo,
            notification_type=NotificationType.ATTENDANCE_CLOCK_OUT
        )
        self.assertEqual(fcp_out.count(), 1)

    def test_leave_application_notifies_company_ceo(self):
        """Leave application submission notifies company CEO."""
        leave_type = LeaveType.objects.create(
            name='Casual Leave Test',
            code='CL-TEST',
            days_allowed=12,
            company=self.fcp_company
        )
        self.client.force_authenticate(user=self.fcp_emp_user)
        next_week = timezone.localdate() + timedelta(days=7)
        res = self.client.post('/api/v1/leaves/requests/', {
            'leave_type': leave_type.id,
            'start_date': str(next_week),
            'end_date': str(next_week),
            'reason': 'Medical checkup'
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # FCP CEO notified
        fcp_leave = Notification.objects.filter(
            recipient=self.fcp_ceo,
            notification_type=NotificationType.LEAVE_SUBMITTED
        )
        self.assertEqual(fcp_leave.count(), 1)
        self.assertIn("Medical checkup", fcp_leave.first().message)

        # FRG CEO not notified
        frg_leave = Notification.objects.filter(
            recipient=self.frg_ceo,
            notification_type=NotificationType.LEAVE_SUBMITTED
        )
        self.assertEqual(frg_leave.count(), 0)

    def test_wfh_application_notifies_company_ceo(self):
        """WFH application submission notifies company CEO."""
        self.client.force_authenticate(user=self.fcp_emp_user)
        next_week = timezone.localdate() + timedelta(days=5)
        res = self.client.post('/api/v1/wfh/requests/', {
            'start_date': str(next_week),
            'end_date': str(next_week),
            'reason': 'Broadband technician visiting'
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        fcp_wfh = Notification.objects.filter(
            recipient=self.fcp_ceo,
            notification_type=NotificationType.WFH_SUBMITTED
        )
        self.assertEqual(fcp_wfh.count(), 1)
        self.assertIn("Broadband technician visiting", fcp_wfh.first().message)

        frg_wfh = Notification.objects.filter(
            recipient=self.frg_ceo,
            notification_type=NotificationType.WFH_SUBMITTED
        )
        self.assertEqual(frg_wfh.count(), 0)

    def test_early_pass_application_notifies_company_ceo(self):
        """EarlyPass application submission notifies company CEO."""
        settings_obj = OrganizationSettings.get_settings()
        settings_obj.early_pass_attachment_mandatory = False
        settings_obj.early_pass_allow_same_day = True
        settings_obj.early_pass_require_advance = False
        settings_obj.save()

        today = timezone.localdate()
        att = Attendance.objects.create(
            employee=self.fcp_employee,
            date=today,
            check_in=timezone.make_aware(datetime.combine(today, time(9, 0))),
            status=AttendanceStatus.PRESENT
        )

        self.client.force_authenticate(user=self.fcp_emp_user)
        res = self.client.post('/api/v1/attendance/early-pass/', {
            'request_date': str(today),
            'requested_exit_time': '15:00',
            'reason': 'Family doctor consultation'
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        fcp_ep = Notification.objects.filter(
            recipient=self.fcp_ceo,
            notification_type=NotificationType.EARLYPASS_SUBMITTED
        )
        self.assertEqual(fcp_ep.count(), 1)
        self.assertIn("Family doctor consultation", fcp_ep.first().message)

        frg_ep = Notification.objects.filter(
            recipient=self.frg_ceo,
            notification_type=NotificationType.EARLYPASS_SUBMITTED
        )
        self.assertEqual(frg_ep.count(), 0)

    def test_attendance_correction_notifies_company_ceo(self):
        """Attendance correction submission notifies company CEO."""
        yesterday = timezone.localdate() - timedelta(days=1)
        self.client.force_authenticate(user=self.fcp_emp_user)
        res = self.client.post('/api/v1/attendance/corrections/', {
            'date': str(yesterday),
            'requested_check_in': f'{yesterday}T09:00:00Z',
            'requested_check_out': f'{yesterday}T18:00:00Z',
            'reason': 'Forgot to punch out due to internet outage'
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        fcp_corr = Notification.objects.filter(
            recipient=self.fcp_ceo,
            notification_type=NotificationType.CORRECTION_SUBMITTED
        )
        self.assertEqual(fcp_corr.count(), 1)
        self.assertIn("Forgot to punch out", fcp_corr.first().message)

        frg_corr = Notification.objects.filter(
            recipient=self.frg_ceo,
            notification_type=NotificationType.CORRECTION_SUBMITTED
        )
        self.assertEqual(frg_corr.count(), 0)
