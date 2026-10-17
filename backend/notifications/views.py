import logging
from django.utils import timezone
from django.db.models import Count, Q
from django.conf import settings
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from notifications.models import (
    Notification, NotificationStatus, DevicePushSubscription, NotificationDelivery
)
from notifications.serializers import (
    NotificationSerializer, DevicePushSubscriptionSerializer
)
from rest_framework.pagination import PageNumberPagination
from notifications.services import NotificationService
from accounts.permissions import IsHR

logger = logging.getLogger('notifications')


class NotificationPagination(PageNumberPagination):
    page_size = 15
    page_size_query_param = 'page_size'
    max_page_size = 100


class NotificationViewSet(viewsets.ModelViewSet):
    """
    Production-grade notification API supporting durable tracking,
    in-app inbox pagination, multi-device subscription, and diagnostics.
    """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = NotificationPagination

    def get_queryset(self):
        user = self.request.user
        qs = Notification.objects.filter(recipient=user).select_related('related_attendance').prefetch_related('deliveries')

        # Filter by read/unread
        is_read_param = self.request.query_params.get('is_read')
        if is_read_param is not None:
            if is_read_param.lower() in ('true', '1'):
                qs = qs.filter(is_read=True)
            elif is_read_param.lower() in ('false', '0'):
                qs = qs.filter(is_read=False)

        # Filter by notification_type
        type_param = self.request.query_params.get('type')
        if type_param:
            qs = qs.filter(notification_type=type_param)

        # Search query across title and message
        search_query = self.request.query_params.get('search')
        if search_query:
            qs = qs.filter(Q(title__icontains=search_query) | Q(message__icontains=search_query))

        return qs.order_by('-created_at')

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Returns the unread count for the authenticated user."""
        count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({'unread_count': count})

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Marks a single notification as read with timestamp."""
        notif = self.get_object()
        notif.is_read = True
        notif.read_at = timezone.now()
        notif.save(update_fields=['is_read', 'read_at', 'updated_at'])
        return Response({'message': 'Notification marked as read.', 'read_at': notif.read_at})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Marks all unread notifications for the user as read."""
        now = timezone.now()
        updated_count = Notification.objects.filter(
            recipient=request.user,
            is_read=False
        ).update(is_read=True, read_at=now)
        return Response({'message': 'All notifications marked as read.', 'count': updated_count})

    @action(detail=False, methods=['get'])
    def vapid_public_key(self, request):
        """Exposes the VAPID public key needed for browser push subscription."""
        key = getattr(settings, 'VAPID_PUBLIC_KEY', '')
        return Response({'public_key': key})

    @action(detail=False, methods=['post'])
    def subscribe(self, request):
        """
        Registers or updates a device push subscription for the user.
        Supports multi-device delivery with deduplication.
        """
        serializer = DevicePushSubscriptionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        endpoint = data['endpoint']
        keys = data['keys']

        sub, created = DevicePushSubscription.objects.update_or_create(
            user=request.user,
            endpoint=endpoint,
            defaults={
                'p256dh': keys['p256dh'],
                'auth': keys['auth'],
                'user_agent': data.get('user_agent', ''),
                'device_name': data.get('device_name', '') or request.META.get('HTTP_USER_AGENT', '')[:50],
                'is_active': True,
                'failed_attempts': 0,
                'last_error': None
            }
        )

        logger.info("Registered push subscription ID=%s (created=%s) for user=%s",
                    sub.id, created, request.user.email)
        return Response({
            'message': 'Device subscription registered successfully.',
            'subscription_id': sub.id,
            'created': created
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def unsubscribe(self, request):
        """Deactivates a device push subscription."""
        endpoint = request.data.get('endpoint')
        if not endpoint:
            return Response({'error': 'Endpoint is required.'}, status=status.HTTP_400_BAD_REQUEST)

        updated = DevicePushSubscription.objects.filter(
            user=request.user,
            endpoint=endpoint
        ).update(is_active=False)

        return Response({'message': 'Unsubscribed successfully.', 'updated': updated})

    @action(detail=True, methods=['post'])
    def ack_displayed(self, request, pk=None):
        """
        Optional Device Display Telemetry Acknowledgement (Section 8).
        Invoked by the Service Worker when showNotification() displays the payload.
        Clearly separated from push_accepted.
        """
        notif = self.get_object()
        now = timezone.now()
        notif.displayed_at = now
        notif.save(update_fields=['displayed_at', 'updated_at'])

        # Also tag active delivery record if found
        endpoint = request.data.get('endpoint')
        if endpoint:
            NotificationDelivery.objects.filter(
                notification=notif,
                endpoint=endpoint
            ).update(displayed_at=now)

        return Response({'status': 'acknowledged', 'displayed_at': now})

    # ─── Secured Administrative & Operational Endpoints (Section 9) ─────────
    @action(detail=False, methods=['get'], permission_classes=[IsHR])
    def metrics(self, request):
        """
        Operational metrics: totals per delivery stage, active devices,
        unread counts, and queue failure rates.
        """
        total = Notification.objects.count()
        status_counts = dict(
            Notification.objects.values_list('status').annotate(count=Count('id'))
        )

        unread_total = Notification.objects.filter(is_read=False).count()
        read_total = Notification.objects.filter(is_read=True).count()
        active_devices = DevicePushSubscription.objects.filter(is_active=True).count()
        total_devices = DevicePushSubscription.objects.count()

        accepted_count = status_counts.get(NotificationStatus.PUSH_ACCEPTED, 0)
        failed_count = status_counts.get(NotificationStatus.PERMANENTLY_FAILED, 0)
        delivery_total = accepted_count + failed_count
        success_rate = round((accepted_count / delivery_total * 100), 2) if delivery_total > 0 else 100.0

        return Response({
            'total_notifications': total,
            'status_breakdown': {
                'created': status_counts.get(NotificationStatus.CREATED, 0),
                'queued': status_counts.get(NotificationStatus.QUEUED, 0),
                'sending': status_counts.get(NotificationStatus.SENDING, 0),
                'push_accepted': accepted_count,
                'retrying': status_counts.get(NotificationStatus.RETRYING, 0),
                'expired': status_counts.get(NotificationStatus.EXPIRED, 0),
                'permanently_failed': failed_count,
            },
            'read_stats': {
                'unread': unread_total,
                'read': read_total
            },
            'device_stats': {
                'active_subscriptions': active_devices,
                'total_subscriptions': total_devices
            },
            'delivery_success_rate_percent': success_rate
        })

    @action(detail=False, methods=['get'], permission_classes=[IsHR])
    def diagnostics(self, request):
        """
        Secured administrative tool to inspect failed, retrying,
        and dead-letter notifications with error diagnostic information.
        Does not expose secrets, credentials, or sensitive payloads.
        """
        failures = Notification.objects.filter(
            status__in=[NotificationStatus.PERMANENTLY_FAILED, NotificationStatus.RETRYING, NotificationStatus.EXPIRED]
        ).select_related('recipient').order_by('-updated_at')[:100]

        data = [
            {
                'id': n.id,
                'event_id': str(n.event_id),
                'recipient_email': n.recipient.email,
                'title': n.title,
                'status': n.status,
                'attempt_count': n.attempt_count,
                'last_attempt_at': n.last_attempt_at,
                'next_retry_at': n.next_retry_at,
                'last_error_category': n.last_error_category,
                'last_error_detail': n.last_error_detail,
                'created_at': n.created_at,
                'updated_at': n.updated_at
            }
            for n in failures
        ]
        return Response({'diagnostic_records': data})

    @action(detail=True, methods=['post'], permission_classes=[IsHR])
    def retry(self, request, pk=None):
        """
        Administrative action to safely re-queue an eligible failed notification.
        """
        reset_count = request.data.get('reset_count', False)
        success, message = NotificationService.retry_notification(pk, reset_count=reset_count)
        status_code = status.HTTP_200_OK if success else status.HTTP_400_BAD_REQUEST
        return Response({'success': success, 'message': message}, status=status_code)

    @action(detail=False, methods=['post'], permission_classes=[IsHR])
    def retry_all_failed(self, request):
        """
        Administrative batch retry for all permanently failed notifications.
        """
        failed_ids = list(
            Notification.objects.filter(status=NotificationStatus.PERMANENTLY_FAILED).values_list('id', flat=True)[:50]
        )
        retried = 0
        for nid in failed_ids:
            s, _ = NotificationService.retry_notification(nid, reset_count=True)
            if s:
                retried += 1
        return Response({'message': f'Queued {retried} failed notifications for re-delivery.'})

    @action(detail=False, methods=['get'], permission_classes=[IsHR])
    def health(self, request):
        """
        Operational health check for notification queue and broker.
        """
        from django.db import connection
        db_ok = False
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                db_ok = True
        except Exception:
            db_ok = False

        # Check Redis connectivity if redis configured
        redis_ok = False
        redis_error = None
        try:
            import redis
            redis_url = getattr(settings, 'CELERY_BROKER_URL', '') or getattr(settings, 'REDIS_URL', '')
            r = redis.Redis.from_url(redis_url, socket_timeout=2)
            redis_ok = r.ping()
        except Exception as e:
            redis_ok = False
            redis_error = str(e)

        pending_count = Notification.objects.filter(status__in=[NotificationStatus.CREATED, NotificationStatus.QUEUED]).count()
        stale_threshold = timezone.now() - timezone.timedelta(seconds=getattr(settings, 'NOTIFICATION_STALE_TIMEOUT_SECONDS', 300))
        stale_sending_count = Notification.objects.filter(status=NotificationStatus.SENDING, last_attempt_at__lt=stale_threshold).count()

        is_healthy = db_ok and (stale_sending_count == 0)

        return Response({
            'healthy': is_healthy,
            'database': 'ok' if db_ok else 'error',
            'redis_broker': 'ok' if redis_ok else ('unavailable' if not redis_ok else 'ok'),
            'redis_error': redis_error if not redis_ok else None,
            'pending_outbox_jobs': pending_count,
            'stale_sending_jobs': stale_sending_count,
            'timestamp': timezone.now()
        })
