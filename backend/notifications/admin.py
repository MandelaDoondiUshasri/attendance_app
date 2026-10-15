from django.contrib import admin
from notifications.models import Notification, DevicePushSubscription, NotificationDelivery
from notifications.services import NotificationService


class NotificationDeliveryInline(admin.TabularInline):
    model = NotificationDelivery
    extra = 0
    readonly_fields = [
        'endpoint', 'status', 'attempt_count', 'last_attempt_at',
        'response_status_code', 'error_category', 'error_detail',
        'push_accepted_at', 'displayed_at', 'created_at'
    ]
    can_delete = False


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'event_id', 'recipient', 'title', 'notification_type',
        'status', 'attempt_count', 'is_read', 'created_at', 'push_accepted_at'
    ]
    list_filter = ['status', 'notification_type', 'is_read', 'last_error_category', 'created_at']
    search_fields = ['title', 'message', 'recipient__email', 'idempotency_key', 'event_id']
    readonly_fields = [
        'event_id', 'created_at', 'updated_at', 'last_attempt_at',
        'next_retry_at', 'push_accepted_at', 'displayed_at', 'read_at'
    ]
    inlines = [NotificationDeliveryInline]
    actions = ['retry_selected_notifications']

    @admin.action(description="Safely retry eligible failed/expired notifications")
    def retry_selected_notifications(self, request, queryset):
        retried = 0
        for notif in queryset:
            success, _ = NotificationService.retry_notification(notif.id, reset_count=True)
            if success:
                retried += 1
        self.message_user(request, f"Successfully re-queued {retried} notification(s).")


@admin.register(DevicePushSubscription)
class DevicePushSubscriptionAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'device_name', 'is_active', 'failed_attempts', 'last_used_at', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['user__email', 'endpoint', 'device_name', 'user_agent']
    readonly_fields = ['created_at', 'updated_at', 'last_used_at']


@admin.register(NotificationDelivery)
class NotificationDeliveryAdmin(admin.ModelAdmin):
    list_display = ['id', 'notification_id', 'status', 'attempt_count', 'response_status_code', 'error_category', 'last_attempt_at']
    list_filter = ['status', 'error_category', 'response_status_code']
    search_fields = ['endpoint', 'error_detail', 'notification__title']
