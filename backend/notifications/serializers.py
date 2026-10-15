from rest_framework import serializers
from notifications.models import Notification, DevicePushSubscription, NotificationDelivery


class NotificationDeliverySerializer(serializers.ModelSerializer):
    device_name = serializers.CharField(source='subscription.device_name', default='', read_only=True)

    class Meta:
        model = NotificationDelivery
        fields = [
            'id', 'endpoint', 'device_name', 'status', 'attempt_count',
            'last_attempt_at', 'response_status_code', 'error_category',
            'error_detail', 'push_accepted_at', 'displayed_at', 'created_at'
        ]


class NotificationSerializer(serializers.ModelSerializer):
    deliveries = NotificationDeliverySerializer(many=True, read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id', 'event_id', 'title', 'message', 'notification_type',
            'payload', 'related_attendance', 'status', 'attempt_count',
            'last_attempt_at', 'next_retry_at', 'last_error_category',
            'last_error_detail', 'push_accepted_at', 'displayed_at',
            'is_read', 'read_at', 'created_at', 'deliveries'
        ]


class PushSubscriptionKeySerializer(serializers.Serializer):
    p256dh = serializers.CharField(required=True)
    auth = serializers.CharField(required=True)


class DevicePushSubscriptionSerializer(serializers.Serializer):
    endpoint = serializers.CharField(required=True)
    keys = PushSubscriptionKeySerializer(required=True)
    user_agent = serializers.CharField(required=False, allow_blank=True, default='')
    device_name = serializers.CharField(required=False, allow_blank=True, default='')
