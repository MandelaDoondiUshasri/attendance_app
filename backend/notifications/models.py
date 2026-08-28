from django.db import models
from django.conf import settings

class NotificationType(models.TextChoices):
    LEAVE_SUBMITTED = 'LEAVE_SUBMITTED', 'Leave Request Submitted'
    LEAVE_APPROVED = 'LEAVE_APPROVED', 'Leave Request Approved'
    LEAVE_REJECTED = 'LEAVE_REJECTED', 'Leave Request Rejected'
    WFH_SUBMITTED = 'WFH_SUBMITTED', 'WFH Request Submitted'
    WFH_APPROVED = 'WFH_APPROVED', 'WFH Request Approved'
    WFH_REJECTED = 'WFH_REJECTED', 'WFH Request Rejected'
    CORRECTION_SUBMITTED = 'CORRECTION_SUBMITTED', 'Attendance Correction Submitted'
    CORRECTION_APPROVED = 'CORRECTION_APPROVED', 'Attendance Correction Approved'
    CORRECTION_REJECTED = 'CORRECTION_REJECTED', 'Attendance Correction Rejected'
    SALARY_INCREMENT = 'SALARY_INCREMENT', 'Salary Increment'
    SALARY_DECREMENT = 'SALARY_DECREMENT', 'Salary Decrement'
    LATE_CLOCK_IN_ALERT = 'LATE_CLOCK_IN_ALERT', 'Late Clock-in Alert'
    LOCATION_UPDATE = 'LOCATION_UPDATE', 'Employee Location Update'
    SYSTEM_ALERT = 'SYSTEM_ALERT', 'System Alert'

class Notification(models.Model):
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=150)
    message = models.TextField()
    notification_type = models.CharField(max_length=30, choices=NotificationType.choices, default=NotificationType.SYSTEM_ALERT)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification for {self.recipient.email}: {self.title}"
