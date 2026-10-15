import uuid
from datetime import timedelta
from django.test import TestCase, TransactionTestCase
from django.db import transaction, IntegrityError
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from notifications.models import (
    Notification, NotificationStatus, NotificationType,
    NotificationErrorCategory, DevicePushSubscription, NotificationDelivery
)
from notifications.services import NotificationService, WebPushSender
from attendance.models import Attendance, AttendanceStatus, AttendanceWorkMode, AttendanceMethod
from employees.models import Employee
from accounts.models import Role

User = get_user_model()


class NotificationReliabilityTests(TestCase):
    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(
            email='alice@example.com',
            password='testpassword123',
            role=Role.EMPLOYEE,
            first_name='Alice',
            last_name='Smith'
        )
        self.other_user = User.objects.create_user(
            email='bob@example.com',
            password='testpassword123',
            role=Role.EMPLOYEE,
            first_name='Bob',
            last_name='Jones'
        )
        self.hr_user = User.objects.create_user(
            email='hr@example.com',
            password='testpassword123',
            role=Role.HR,
            first_name='HR',
            last_name='Admin'
        )
        self.employee = Employee.objects.create(
            user=self.user,
            employee_id='EMP-001',
            full_name='Alice Smith',
            email=self.user.email,
            joining_date=timezone.now().date()
        )
        self.attendance = Attendance.objects.create(
            employee=self.employee,
            date=timezone.now().date(),
            check_in=timezone.now(),
            status=AttendanceStatus.PRESENT,
            work_mode=AttendanceWorkMode.OFFICE,
            attendance_method=AttendanceMethod.WEB_PORTAL
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        # Reset mock web push sender before each test
        WebPushSender.reset_mock_handler()

    def tearDown(self):
        WebPushSender.reset_mock_handler()
        super().tearDown()

    def test_durable_creation_of_notification_records(self):
        """1. Durable record persisted in DB with all required metadata."""
        notif = NotificationService.create_notification(
            recipient=self.user,
            title="Clock-in Recorded",
            message="Your clock-in at 09:00 AM was recorded successfully.",
            notification_type=NotificationType.ATTENDANCE_CLOCK_IN,
            related_attendance=self.attendance,
            payload={"route": "/attendance", "attendance_id": self.attendance.id},
            idempotency_key="clock_in_emp001_today",
            async_dispatch=False
        )

        self.assertIsNotNone(notif.id)
        self.assertIsNotNone(notif.event_id)
        self.assertEqual(notif.recipient, self.user)
        self.assertEqual(notif.status, NotificationStatus.CREATED)
        self.assertEqual(notif.attempt_count, 0)
        self.assertFalse(notif.is_read)
        self.assertIsNone(notif.read_at)
        self.assertIsNone(notif.push_accepted_at)
        self.assertEqual(notif.related_attendance, self.attendance)
        self.assertEqual(notif.payload.get("attendance_id"), self.attendance.id)
        self.assertEqual(notif.idempotency_key, "clock_in_emp001_today")

    def test_duplicate_event_prevention_via_idempotency_key(self):
        """1 & 5. Duplicate event creation prevention using idempotency key."""
        notif1 = NotificationService.create_notification(
            recipient=self.user,
            title="Attendance Clock-in",
            message="First attempt",
            idempotency_key="unique_event_key_123",
            async_dispatch=False
        )
        notif2 = NotificationService.create_notification(
            recipient=self.user,
            title="Attendance Clock-in Duplicate",
            message="Second attempt",
            idempotency_key="unique_event_key_123",
            async_dispatch=False
        )

        self.assertEqual(notif1.id, notif2.id)
        self.assertEqual(Notification.objects.filter(idempotency_key="unique_event_key_123").count(), 1)

    def test_multi_device_delivery_and_push_acceptance(self):
        """2, 3, 5 & 8. Multi-device delivery where push gateway accepts requests."""
        sub1 = DevicePushSubscription.objects.create(
            user=self.user,
            endpoint="https://fcm.googleapis.com/fcm/send/phone1",
            p256dh="key1",
            auth="auth1",
            device_name="Pixel 8 Phone"
        )
        sub2 = DevicePushSubscription.objects.create(
            user=self.user,
            endpoint="https://updates.push.services.mozilla.com/wpush/v2/browser1",
            p256dh="key2",
            auth="auth2",
            device_name="MacBook Chrome"
        )

        # Mock push gateway: returns 201 Created for all active subscriptions
        WebPushSender.set_mock_handler(lambda info, payload, ttl: {
            "status_code": 201,
            "headers": {},
            "text": "Accepted by gateway"
        })

        notif = NotificationService.create_notification(
            recipient=self.user,
            title="EarlyPass Approved",
            message="Your early pass request has been approved.",
            notification_type=NotificationType.EARLYPASS_APPROVED,
            async_dispatch=False
        )

        dispatched = NotificationService.dispatch_notification(notif.id)

        self.assertEqual(dispatched.status, NotificationStatus.PUSH_ACCEPTED)
        self.assertIsNotNone(dispatched.push_accepted_at)
        self.assertIsNone(dispatched.displayed_at)  # Crucial: push acceptance != phone display
        self.assertEqual(dispatched.attempt_count, 1)

        deliveries = NotificationDelivery.objects.filter(notification=notif)
        self.assertEqual(deliveries.count(), 2)
        for d in deliveries:
            self.assertEqual(d.status, NotificationStatus.PUSH_ACCEPTED)
            self.assertEqual(d.response_status_code, 201)

    def test_independent_device_failures_do_not_block_other_devices(self):
        """4 & 5. If one device encounters 410 Gone (expired), other active devices succeed."""
        sub_expired = DevicePushSubscription.objects.create(
            user=self.user,
            endpoint="https://fcm.googleapis.com/expired-phone",
            p256dh="key-old",
            auth="auth-old",
            device_name="Old Tablet"
        )
        sub_healthy = DevicePushSubscription.objects.create(
            user=self.user,
            endpoint="https://fcm.googleapis.com/active-phone",
            p256dh="key-act",
            auth="auth-act",
            device_name="Active Phone"
        )

        # Mock: 410 for expired endpoint, 201 for active endpoint
        def mock_push(sub_info, payload, ttl):
            if "expired-phone" in sub_info["endpoint"]:
                return {"status_code": 410, "headers": {}, "text": "Subscription Gone"}
            return {"status_code": 201, "headers": {}, "text": "OK"}

        WebPushSender.set_mock_handler(mock_push)

        notif = NotificationService.create_notification(
            recipient=self.user,
            title="Leave Approved",
            message="Leave approved.",
            async_dispatch=False
        )

        dispatched = NotificationService.dispatch_notification(notif.id)

        # Notification aggregate status is PUSH_ACCEPTED because the active device succeeded
        self.assertEqual(dispatched.status, NotificationStatus.PUSH_ACCEPTED)

        # Expired subscription was automatically deactivated
        sub_expired.refresh_from_db()
        self.assertFalse(sub_expired.is_active)
        self.assertIn("410", sub_expired.last_error)

        # Healthy subscription remains active
        sub_healthy.refresh_from_db()
        self.assertTrue(sub_healthy.is_active)

    def test_rate_limiting_and_retry_after(self):
        """2 & 4. HTTP 429 response respects Retry-After and schedules RETRYING."""
        DevicePushSubscription.objects.create(
            user=self.user,
            endpoint="https://fcm.googleapis.com/rate-limited",
            p256dh="key",
            auth="auth"
        )

        WebPushSender.set_mock_handler(lambda info, payload, ttl: {
            "status_code": 429,
            "headers": {"Retry-After": "120"},
            "text": "Too many requests"
        })

        notif = NotificationService.create_notification(
            recipient=self.user,
            title="Shift Alert",
            message="Shift update",
            async_dispatch=False
        )

        dispatched = NotificationService.dispatch_notification(notif.id)

        self.assertEqual(dispatched.status, NotificationStatus.RETRYING)
        self.assertEqual(dispatched.last_error_category, NotificationErrorCategory.RATE_LIMITED)
        self.assertIsNotNone(dispatched.next_retry_at)
        # Next retry scheduled ~120s from now
        diff = (dispatched.next_retry_at - timezone.now()).total_seconds()
        self.assertGreaterEqual(diff, 110)
        self.assertLessEqual(diff, 130)

    def test_transient_error_exponential_backoff_and_bounded_retries(self):
        """2 & 4. Transient HTTP 503 retries with exponential backoff and exhausts at max retries."""
        DevicePushSubscription.objects.create(
            user=self.user,
            endpoint="https://fcm.googleapis.com/server-error",
            p256dh="key",
            auth="auth"
        )

        WebPushSender.set_mock_handler(lambda info, payload, ttl: {
            "status_code": 503,
            "headers": {},
            "text": "Service Unavailable"
        })

        notif = NotificationService.create_notification(
            recipient=self.user,
            title="Correction Alert",
            message="Correction update",
            async_dispatch=False
        )

        # First failure -> RETRYING (attempt 1)
        dispatched1 = NotificationService.dispatch_notification(notif.id)
        self.assertEqual(dispatched1.status, NotificationStatus.RETRYING)
        self.assertEqual(dispatched1.attempt_count, 1)

        # Fast forward attempts to max retries
        notif.attempt_count = 4
        notif.status = NotificationStatus.QUEUED
        notif.save()

        # Attempt 5 -> reaches MAX_RETRIES (5) -> PERMANENTLY_FAILED
        dispatched_final = NotificationService.dispatch_notification(notif.id)
        self.assertEqual(dispatched_final.status, NotificationStatus.PERMANENTLY_FAILED)
        self.assertIsNone(dispatched_final.next_retry_at)
        self.assertIn("Exhausted", dispatched_final.last_error_detail)

    def test_stale_sending_recovery(self):
        """4. Outbox recovery detects jobs stuck in SENDING and re-queues them."""
        stale_time = timezone.now() - timedelta(minutes=10)
        stale_notif = Notification.objects.create(
            recipient=self.user,
            title="Stale Job",
            message="Worker crashed mid-send",
            status=NotificationStatus.SENDING,
            attempt_count=1,
            last_attempt_at=stale_time
        )

        recovered = NotificationService.recover_stale_and_pending_jobs()
        self.assertGreaterEqual(recovered, 1)

        stale_notif.refresh_from_db()
        self.assertEqual(stale_notif.status, NotificationStatus.QUEUED)

    def test_inbox_access_controls(self):
        """7. Users can only access their own notifications in the inbox."""
        user_notif = Notification.objects.create(
            recipient=self.user,
            title="Alice's Notification",
            message="Secret to Alice",
            status=NotificationStatus.PUSH_ACCEPTED
        )
        other_notif = Notification.objects.create(
            recipient=self.other_user,
            title="Bob's Notification",
            message="Secret to Bob",
            status=NotificationStatus.PUSH_ACCEPTED
        )

        # Alice requests inbox
        res = self.client.get('/api/v1/notifications/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get('results', res.data)
        ids = [item['id'] for item in results]
        self.assertIn(user_notif.id, ids)
        self.assertNotIn(other_notif.id, ids)

        # Alice cannot mark Bob's notification as read
        mark_res = self.client.post(f'/api/v1/notifications/{other_notif.id}/mark_read/')
        self.assertEqual(mark_res.status_code, status.HTTP_404_NOT_FOUND)

    def test_inbox_read_and_display_telemetry_separation(self):
        """7 & 8. Clear separation between in-app read, push acceptance, and display ack."""
        notif = Notification.objects.create(
            recipient=self.user,
            title="Status Differentiation",
            message="Tracking stages independently",
            status=NotificationStatus.PUSH_ACCEPTED,
            push_accepted_at=timezone.now(),
            is_read=False
        )

        self.assertIsNone(notif.displayed_at)
        self.assertFalse(notif.is_read)

        # Simulate service worker acknowledging display
        ack_res = self.client.post(f'/api/v1/notifications/{notif.id}/ack_displayed/')
        self.assertEqual(ack_res.status_code, status.HTTP_200_OK)
        notif.refresh_from_db()
        self.assertIsNotNone(notif.displayed_at)
        self.assertFalse(notif.is_read)  # Still unread by user!

        # Now user clicks and reads it in inbox
        read_res = self.client.post(f'/api/v1/notifications/{notif.id}/mark_read/')
        self.assertEqual(read_res.status_code, status.HTTP_200_OK)
        notif.refresh_from_db()
        self.assertTrue(notif.is_read)
        self.assertIsNotNone(notif.read_at)

    def test_administrative_retry_tool(self):
        """9. Secured endpoint allows HR/CEO to retry permanently failed notifications."""
        failed_notif = Notification.objects.create(
            recipient=self.user,
            title="Failed Notification",
            message="Previously failed",
            status=NotificationStatus.PERMANENTLY_FAILED,
            attempt_count=5
        )

        # Standard employee is forbidden
        emp_res = self.client.post(f'/api/v1/notifications/{failed_notif.id}/retry/')
        self.assertEqual(emp_res.status_code, status.HTTP_403_FORBIDDEN)

        # HR / CEO user is authorized
        hr_client = APIClient()
        hr_client.force_authenticate(user=self.hr_user)
        hr_res = hr_client.post(f'/api/v1/notifications/{failed_notif.id}/retry/', {'reset_count': True})
        self.assertEqual(hr_res.status_code, status.HTTP_200_OK)

        failed_notif.refresh_from_db()
        self.assertEqual(failed_notif.status, NotificationStatus.QUEUED)
        self.assertEqual(failed_notif.attempt_count, 0)

    def test_clock_in_and_clock_out_produce_durable_notifications(self):
        """1. Legitimate attendance clock_in and clock_out operations produce durable notifications."""
        # Create a fresh employee without attendance today
        fresh_user = User.objects.create_user(
            email='david@example.com',
            password='testpassword123',
            role=Role.EMPLOYEE,
            first_name='David',
            last_name='Miller'
        )
        Employee.objects.create(
            user=fresh_user,
            employee_id='EMP-002',
            full_name='David Miller',
            email=fresh_user.email,
            joining_date=timezone.now().date()
        )

        client = APIClient()
        client.force_authenticate(user=fresh_user)

        # 1. Clock In via Web Portal
        clock_in_res = client.post('/api/v1/attendance/clock_in/')
        self.assertIn(clock_in_res.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])

        # Verify durable notification created for clock in
        clock_in_notif = Notification.objects.filter(
            recipient=fresh_user,
            notification_type=NotificationType.ATTENDANCE_CLOCK_IN
        ).first()
        self.assertIsNotNone(clock_in_notif)
        self.assertIn("Clock-in Recorded", clock_in_notif.title)
        self.assertIsNotNone(clock_in_notif.related_attendance)

        # 2. Clock Out via Web Portal
        clock_out_res = client.post('/api/v1/attendance/clock-out/')
        self.assertEqual(clock_out_res.status_code, status.HTTP_200_OK)

        # Verify durable notification created for clock out
        clock_out_notif = Notification.objects.filter(
            recipient=fresh_user,
            notification_type=NotificationType.ATTENDANCE_CLOCK_OUT
        ).first()
        self.assertIsNotNone(clock_out_notif)
        self.assertIn("Clock-out Recorded", clock_out_notif.title)
        self.assertEqual(clock_out_notif.related_attendance, clock_in_notif.related_attendance)

    def test_concurrent_worker_locking_prevents_duplicate_processing(self):
        """2. Worker concurrency lock: when notification is already SENDING, second worker skips."""
        notif = Notification.objects.create(
            recipient=self.user,
            title="Concurrent Job",
            message="Testing lock",
            status=NotificationStatus.SENDING,
            attempt_count=1,
            last_attempt_at=timezone.now()  # Active, not stale
        )

        # Second worker attempts to dispatch
        res = NotificationService.dispatch_notification(notif.id)
        # Should skip and return without changing attempt count
        notif.refresh_from_db()
        self.assertEqual(notif.attempt_count, 1)

    def test_operational_metrics_endpoint(self):
        """9. Metrics endpoint calculates breakdown accurately."""
        hr_client = APIClient()
        hr_client.force_authenticate(user=self.hr_user)

        res = hr_client.get('/api/v1/notifications/metrics/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('total_notifications', res.data)
        self.assertIn('status_breakdown', res.data)
        self.assertIn('device_stats', res.data)
        self.assertIn('delivery_success_rate_percent', res.data)


class TransactionRollbackTests(TransactionTestCase):
    """
    Tests transactional integrity: notifications created within an aborted
    transaction must be rolled back and never dispatched (Section 1).
    """
    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(
            email='charlie@example.com',
            password='testpassword123',
            role=Role.EMPLOYEE
        )

    def test_notification_rolled_back_on_transaction_failure(self):
        initial_count = Notification.objects.count()

        try:
            with transaction.atomic():
                NotificationService.create_notification(
                    recipient=self.user,
                    title="Will Be Rolled Back",
                    message="This should not persist",
                    idempotency_key="rolled_back_event_1"
                )
                # Force rollback
                raise IntegrityError("Simulated database constraint failure during attendance mark")
        except IntegrityError:
            pass

        # Verify no notification record was preserved
        self.assertEqual(Notification.objects.count(), initial_count)
        self.assertFalse(Notification.objects.filter(idempotency_key="rolled_back_event_1").exists())
