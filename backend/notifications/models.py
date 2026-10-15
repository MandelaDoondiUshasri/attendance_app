import uuid
from django.db import models
from django.conf import settings


class NotificationType(models.TextChoices):
    # Attendance events
    ATTENDANCE_CLOCK_IN = 'ATTENDANCE_CLOCK_IN', 'Clock-in Recorded'
    ATTENDANCE_CLOCK_OUT = 'ATTENDANCE_CLOCK_OUT', 'Clock-out Recorded'
    LATE_CLOCK_IN_ALERT = 'LATE_CLOCK_IN_ALERT', 'Late Clock-in Alert'
    CORRECTION_SUBMITTED = 'CORRECTION_SUBMITTED', 'Attendance Correction Submitted'
    CORRECTION_APPROVED = 'CORRECTION_APPROVED', 'Attendance Correction Approved'
    CORRECTION_REJECTED = 'CORRECTION_REJECTED', 'Attendance Correction Rejected'
    EARLYPASS_SUBMITTED = 'EARLYPASS_SUBMITTED', 'EarlyPass Request Submitted'
    EARLYPASS_APPROVED = 'EARLYPASS_APPROVED', 'EarlyPass Request Approved'
    EARLYPASS_REJECTED = 'EARLYPASS_REJECTED', 'EarlyPass Request Rejected'
    EARLYPASS_CANCELLED = 'EARLYPASS_CANCELLED', 'EarlyPass Request Cancelled'
    
    # Leaves & WFH
    LEAVE_SUBMITTED = 'LEAVE_SUBMITTED', 'Leave Request Submitted'
    LEAVE_APPROVED = 'LEAVE_APPROVED', 'Leave Request Approved'
    LEAVE_REJECTED = 'LEAVE_REJECTED', 'Leave Request Rejected'
    WFH_SUBMITTED = 'WFH_SUBMITTED', 'WFH Request Submitted'
    WFH_APPROVED = 'WFH_APPROVED', 'WFH Request Approved'
    WFH_REJECTED = 'WFH_REJECTED', 'WFH Request Rejected'

    # Salaries & Alerts
    SALARY_INCREMENT = 'SALARY_INCREMENT', 'Salary Increment'
    SALARY_DECREMENT = 'SALARY_DECREMENT', 'Salary Decrement'
    PAYSLIP_RELEASED = 'PAYSLIP_RELEASED', 'Payslip Officially Released'
    LOCATION_UPDATE = 'LOCATION_UPDATE', 'Employee Location Update'
    SYSTEM_ALERT = 'SYSTEM_ALERT', 'System Alert'


class NotificationStatus(models.TextChoices):
    CREATED = 'created', 'Created'
    QUEUED = 'queued', 'Queued'
    SENDING = 'sending', 'Sending'
    PUSH_ACCEPTED = 'push_accepted', 'Push Accepted'
    RETRYING = 'retrying', 'Retrying'
    EXPIRED = 'expired', 'Expired'
    PERMANENTLY_FAILED = 'permanently_failed', 'Permanently Failed'


class NotificationErrorCategory(models.TextChoices):
    NETWORK_ERROR = 'NETWORK_ERROR', 'Network or Connection Error'
    RATE_LIMITED = 'RATE_LIMITED', 'Rate Limited (HTTP 429)'
    SERVER_ERROR = 'SERVER_ERROR', 'Push Server Error (HTTP 5xx)'
    CLIENT_ERROR = 'CLIENT_ERROR', 'Push Client Error (HTTP 4xx)'
    EXPIRED_SUBSCRIPTION = 'EXPIRED_SUBSCRIPTION', 'Expired or Invalid Subscription (HTTP 404/410)'
    NO_ACTIVE_DEVICES = 'NO_ACTIVE_DEVICES', 'No Active Device Subscriptions'
    PAYLOAD_ERROR = 'PAYLOAD_ERROR', 'Payload Formatting Error'
    INTERNAL_ERROR = 'INTERNAL_ERROR', 'Internal Worker Error'


class Notification(models.Model):
    # Unique event identifier for external tracking, service-worker tagging, and logs
    event_id = models.UUIDField(default=uuid.uuid4, editable=False, db_index=True, null=True, blank=True)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        db_index=True
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(
        max_length=50,
        choices=NotificationType.choices,
        default=NotificationType.SYSTEM_ALERT,
        db_index=True
    )
    payload = models.JSONField(default=dict, blank=True)
    related_attendance = models.ForeignKey(
        'attendance.Attendance',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications'
    )

    # ─── Delivery Processing Status (Section 1 & 3) ─────────────────────────
    status = models.CharField(
        max_length=30,
        choices=NotificationStatus.choices,
        default=NotificationStatus.CREATED,
        db_index=True
    )
    attempt_count = models.PositiveIntegerField(default=0)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    next_retry_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_error_category = models.CharField(
        max_length=50,
        choices=NotificationErrorCategory.choices,
        null=True,
        blank=True,
        db_index=True
    )
    last_error_detail = models.TextField(blank=True, null=True)
    push_accepted_at = models.DateTimeField(null=True, blank=True)

    # ─── Device Display Telemetry Acknowledgement (Section 8) ────────────────
    # Populated only if browser service worker successfully pings display telemetry
    displayed_at = models.DateTimeField(null=True, blank=True)

    # ─── In-App Read Tracking (Section 7) ───────────────────────────────────
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)

    # ─── Idempotency Key (Section 1) ─────────────────────────────────────────
    idempotency_key = models.CharField(
        max_length=255,
        unique=True,
        null=True,
        blank=True,
        db_index=True
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read', '-created_at']),
            models.Index(fields=['status', 'next_retry_at']),
        ]

    def __str__(self):
        return f"Notification [{self.status}] for {self.recipient.email}: {self.title}"


class DevicePushSubscription(models.Model):
    """
    Tracks browser / mobile PWA push subscriptions per user.
    Enables multi-device delivery without duplicating notifications.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='push_subscriptions',
        db_index=True
    )
    endpoint = models.TextField()
    p256dh = models.TextField()
    auth = models.TextField()
    user_agent = models.CharField(max_length=255, blank=True, default='')
    device_name = models.CharField(max_length=100, blank=True, default='')
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    failed_attempts = models.PositiveIntegerField(default=0)
    last_error = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ['user', 'endpoint']
        ordering = ['-updated_at']

    def __str__(self):
        return f"Subscription ({self.device_name or 'Web'}) for {self.user.email} [Active={self.is_active}]"


class NotificationDelivery(models.Model):
    """
    Per-device delivery audit trail.
    Ensures that if one device fails (e.g. 410 Gone),
    other active devices continue uninterrupted.
    """
    notification = models.ForeignKey(
        Notification,
        on_delete=models.CASCADE,
        related_name='deliveries'
    )
    subscription = models.ForeignKey(
        DevicePushSubscription,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='deliveries'
    )
    endpoint = models.TextField()
    status = models.CharField(
        max_length=30,
        choices=NotificationStatus.choices,
        default=NotificationStatus.CREATED
    )
    attempt_count = models.PositiveIntegerField(default=0)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    response_status_code = models.IntegerField(null=True, blank=True)
    error_category = models.CharField(max_length=50, blank=True, null=True)
    error_detail = models.TextField(blank=True, null=True)
    push_accepted_at = models.DateTimeField(null=True, blank=True)
    displayed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Delivery for Notif #{self.notification_id} -> {self.status}"
