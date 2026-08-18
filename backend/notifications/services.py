from notifications.models import Notification, NotificationType

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
