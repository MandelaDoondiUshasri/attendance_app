from notifications.models import Notification, NotificationType
from django.contrib.auth import get_user_model

class NotificationService:
    @staticmethod
    def create_notification(recipient, title, message, notification_type=NotificationType.SYSTEM_ALERT):
        if not recipient:
            return None
        return Notification.objects.create(
            recipient=recipient,
            title=title,
            message=message,
            notification_type=notification_type
        )

    @classmethod
    def notify_management(cls, title, message, notification_type=NotificationType.SYSTEM_ALERT):
        User = get_user_model()
        from accounts.models import Role
        managers = User.objects.filter(role__in=[Role.CEO, Role.HR], is_active=True)
        notifications = [
            Notification(recipient=mgr, title=title, message=message, notification_type=notification_type)
            for mgr in managers
        ]
        if notifications:
            Notification.objects.bulk_create(notifications)
        return len(notifications)
