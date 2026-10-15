import logging
import random
import json
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime
from django.db import transaction
from django.utils import timezone
from django.conf import settings
from django.contrib.auth import get_user_model

from notifications.models import (
    Notification, NotificationType, NotificationStatus,
    NotificationErrorCategory, DevicePushSubscription, NotificationDelivery
)

logger = logging.getLogger('notifications')


class WebPushSender:
    """
    Encapsulates webpush delivery via pywebpush with test-override support.
    """
    _mock_handler = None

    @classmethod
    def set_mock_handler(cls, handler):
        """Used in unit tests to simulate push-service HTTP responses."""
        cls._mock_handler = handler

    @classmethod
    def reset_mock_handler(cls):
        cls._mock_handler = None

    @classmethod
    def send_web_push(cls, subscription_info, payload_data, ttl=86400):
        if cls._mock_handler is not None:
            return cls._mock_handler(subscription_info, payload_data, ttl)

        from pywebpush import webpush, WebPushException

        vapid_private_key = getattr(settings, 'VAPID_PRIVATE_KEY', '')
        vapid_claims = {
            "sub": f"mailto:{getattr(settings, 'VAPID_ADMIN_EMAIL', 'admin@frgattendance.com')}"
        }

        # If private key is not configured, simulate local delivery acceptance
        if not vapid_private_key:
            logger.warning("VAPID_PRIVATE_KEY is not configured; simulated acceptance.")
            return {"status_code": 201, "headers": {}, "text": "Simulated push accepted"}

        try:
            response = webpush(
                subscription_info=subscription_info,
                data=json.dumps(payload_data),
                vapid_private_key=vapid_private_key,
                vapid_claims=vapid_claims,
                ttl=ttl
            )
            return {
                "status_code": response.status_code if hasattr(response, 'status_code') else 201,
                "headers": dict(response.headers) if hasattr(response, 'headers') else {},
                "text": response.text if hasattr(response, 'text') else 'OK'
            }
        except WebPushException as ex:
            status_code = getattr(ex.response, 'status_code', 500) if getattr(ex, 'response', None) else 500
            headers = dict(ex.response.headers) if getattr(ex, 'response', None) and hasattr(ex.response, 'headers') else {}
            return {
                "status_code": status_code,
                "headers": headers,
                "text": str(ex),
                "exception": ex
            }
        except Exception as ex:
            return {
                "status_code": 500,
                "headers": {},
                "text": str(ex),
                "exception": ex
            }


class NotificationService:
    @staticmethod
    def create_notification(
        recipient,
        title,
        message,
        notification_type=NotificationType.SYSTEM_ALERT,
        related_attendance=None,
        payload=None,
        idempotency_key=None,
        async_dispatch=True
    ):
        """
        Durable Notification Record Creation (Section 1).
        Uses transactional outbox pattern: hooks into transaction.on_commit()
        to guarantee no notifications are dispatched for rolled-back transactions.
        """
        if not recipient:
            return None

        # Idempotency check: prevent duplicate event creation
        if idempotency_key:
            existing = Notification.objects.filter(idempotency_key=idempotency_key).first()
            if existing:
                logger.info(
                    "Duplicate notification ignored via idempotency key: %s (ID: %s)",
                    idempotency_key, existing.id
                )
                return existing

        payload = payload or {}

        # Persist notification in CREATED status
        notification = Notification.objects.create(
            recipient=recipient,
            title=title,
            message=message,
            notification_type=notification_type,
            related_attendance=related_attendance,
            payload=payload,
            idempotency_key=idempotency_key,
            status=NotificationStatus.CREATED
        )

        logger.info(
            "Created durable notification record ID=%s, type=%s, recipient=%s, idempotency_key=%s",
            notification.id, notification_type, recipient.email, idempotency_key
        )

        if async_dispatch:
            # Transactional Outbox Pattern: Schedule only after database commit
            transaction.on_commit(lambda: NotificationService.schedule_dispatch(notification.id))

        return notification

    @classmethod
    def notify_management(
        cls,
        title,
        message,
        notification_type=NotificationType.SYSTEM_ALERT,
        related_attendance=None,
        payload=None,
        idempotency_prefix=None
    ):
        """
        Transactionally creates notification records for all management roles (CEO, HR).
        """
        User = get_user_model()
        from accounts.models import Role
        managers = User.objects.filter(role__in=[Role.CEO, Role.HR], is_active=True)
        notifications = []
        for mgr in managers:
            idempotency_key = f"{idempotency_prefix}_{mgr.id}" if idempotency_prefix else None
            notif = cls.create_notification(
                recipient=mgr,
                title=title,
                message=message,
                notification_type=notification_type,
                related_attendance=related_attendance,
                payload=payload,
                idempotency_key=idempotency_key
            )
            if notif:
                notifications.append(notif)
        return len(notifications)

    @staticmethod
    def schedule_dispatch(notification_id, countdown=0):
        """
        Schedules background delivery via Celery task queue if available,
        falling back gracefully to synchronous execution or outbox scan.
        """
        try:
            from notifications.tasks import process_notification_job
            if countdown > 0:
                process_notification_job.apply_async(args=[notification_id], countdown=countdown)
            else:
                process_notification_job.delay(notification_id)
            logger.info("Enqueued Celery job for notification ID=%s (countdown=%ss)", notification_id, countdown)
        except Exception as e:
            logger.warning(
                "Celery broker unavailable or task scheduling failed for ID=%s: %s. Notification preserved in outbox.",
                notification_id, e
            )
            # Mark as QUEUED so the periodic outbox recovery runner will process it
            Notification.objects.filter(id=notification_id, status=NotificationStatus.CREATED).update(
                status=NotificationStatus.QUEUED
            )

    @classmethod
    def dispatch_notification(cls, notification_id):
        """
        Durable Background Processing Engine (Section 2, 4, 5, 8).
        - Concurrency protection using select_for_update(skip_locked=True)
        - Multi-device delivery loop
        - Exponential backoff with jitter and Retry-After
        - Accurate status transitions
        """
        max_retries = getattr(settings, 'NOTIFICATION_MAX_RETRIES', 5)
        base_delay = getattr(settings, 'NOTIFICATION_BASE_RETRY_DELAY', 10)
        max_delay = getattr(settings, 'NOTIFICATION_MAX_RETRY_DELAY', 3600)
        retry_window = getattr(settings, 'NOTIFICATION_RETRY_WINDOW_SECONDS', 86400)
        stale_timeout = getattr(settings, 'NOTIFICATION_STALE_TIMEOUT_SECONDS', 300)

        with transaction.atomic():
            # Concurrency protection: acquire row lock, skip if locked by another active worker
            notif = Notification.objects.select_for_update(skip_locked=True).filter(id=notification_id).first()
            if not notif:
                logger.debug("Notification ID=%s skipped: locked or non-existent.", notification_id)
                return None

            # Skip if already reached terminal state
            if notif.status in [NotificationStatus.PUSH_ACCEPTED, NotificationStatus.PERMANENTLY_FAILED]:
                logger.debug("Notification ID=%s already in terminal state: %s", notification_id, notif.status)
                return notif

            # Concurrency check for active SENDING
            if notif.status == NotificationStatus.SENDING:
                stale_threshold = timezone.now() - timedelta(seconds=stale_timeout)
                if notif.last_attempt_at and notif.last_attempt_at > stale_threshold:
                    logger.debug("Notification ID=%s is actively being processed by another worker.", notification_id)
                    return notif

            # Check bounded retry window
            if timezone.now() - notif.created_at > timedelta(seconds=retry_window):
                notif.status = NotificationStatus.PERMANENTLY_FAILED
                notif.last_error_category = NotificationErrorCategory.INTERNAL_ERROR
                notif.last_error_detail = f"Delivery retry window of {retry_window}s exceeded."
                notif.save(update_fields=['status', 'last_error_category', 'last_error_detail', 'updated_at'])
                logger.warning("Notification ID=%s permanently failed: retry window exceeded.", notification_id)
                return notif

            # Mark SENDING and increment attempt count
            notif.status = NotificationStatus.SENDING
            notif.attempt_count += 1
            notif.last_attempt_at = timezone.now()
            notif.save(update_fields=['status', 'attempt_count', 'last_attempt_at', 'updated_at'])

        # ─── Multi-Device Delivery (Section 5) ──────────────────────────────
        active_subscriptions = list(DevicePushSubscription.objects.filter(
            user=notif.recipient,
            is_active=True
        ))

        if not active_subscriptions:
            # Recipient has no active push subscriptions.
            # Notification remains durably preserved in the DB for the in-app inbox (Section 7).
            with transaction.atomic():
                n_refresh = Notification.objects.select_for_update().filter(id=notification_id).first()
                if n_refresh:
                    # Stored in inbox without push delivery
                    n_refresh.status = NotificationStatus.CREATED
                    n_refresh.last_error_category = NotificationErrorCategory.NO_ACTIVE_DEVICES
                    n_refresh.last_error_detail = "No active device push subscriptions registered."
                    n_refresh.save(update_fields=['status', 'last_error_category', 'last_error_detail', 'updated_at'])
            logger.info("Notification ID=%s durably recorded for user %s (inbox ready; no active push devices)",
                        notification_id, notif.recipient.email)
            return notif

        # Safe push payload formatted for Service Worker
        push_payload = {
            "id": notif.id,
            "event_id": str(notif.event_id),
            "title": notif.title,
            "message": notif.message,
            "notification_type": notif.notification_type,
            "payload": notif.payload or {},
            "url": (notif.payload or {}).get("route", "/attendance"),
            "created_at": notif.created_at.isoformat()
        }

        any_accepted = False
        any_retrying = False
        all_expired = True
        retry_after_delay = None
        last_error_cat = None
        last_error_msg = None

        for sub in active_subscriptions:
            delivery, _ = NotificationDelivery.objects.get_or_create(
                notification=notif,
                subscription=sub,
                defaults={'endpoint': sub.endpoint, 'status': NotificationStatus.SENDING}
            )
            delivery.attempt_count += 1
            delivery.last_attempt_at = timezone.now()

            sub_info = {
                "endpoint": sub.endpoint,
                "keys": {
                    "p256dh": sub.p256dh,
                    "auth": sub.auth
                }
            }

            resp = WebPushSender.send_web_push(sub_info, push_payload)
            code = resp.get("status_code", 500)
            delivery.response_status_code = code

            if 200 <= code < 300:
                # ─── Push Service Accepted (Section 3 & 8) ───────────────────
                # Request accepted by external push gateway (FCM, Apple, Mozilla)
                delivery.status = NotificationStatus.PUSH_ACCEPTED
                delivery.push_accepted_at = timezone.now()
                delivery.error_category = None
                delivery.error_detail = None
                delivery.save()

                sub.last_used_at = timezone.now()
                sub.failed_attempts = 0
                sub.save(update_fields=['last_used_at', 'failed_attempts', 'updated_at'])

                any_accepted = True
                all_expired = False
                logger.info("Push accepted by gateway for Notif ID=%s Device=%s (code %s)",
                            notif.id, sub.device_name or sub.id, code)

            elif code in (404, 410):
                # ─── Expired / Invalid Subscription (Section 4) ─────────────
                delivery.status = NotificationStatus.EXPIRED
                delivery.error_category = NotificationErrorCategory.EXPIRED_SUBSCRIPTION
                delivery.error_detail = f"Device push subscription expired or revoked (HTTP {code})."
                delivery.save()

                sub.is_active = False
                sub.last_error = f"Subscription expired (HTTP {code})"
                sub.save(update_fields=['is_active', 'last_error', 'updated_at'])
                logger.info("Subscription marked inactive for user %s endpoint (HTTP %s)", notif.recipient.email, code)

            elif code == 429:
                # ─── Rate Limited (Section 2 & 4) ───────────────────────────
                delivery.status = NotificationStatus.RETRYING
                delivery.error_category = NotificationErrorCategory.RATE_LIMITED
                delivery.error_detail = resp.get("text", "HTTP 429 Rate limited")
                delivery.save()

                any_retrying = True
                all_expired = False
                last_error_cat = NotificationErrorCategory.RATE_LIMITED
                last_error_msg = delivery.error_detail

                # Respect Retry-After header
                headers = resp.get("headers", {})
                ra = headers.get("Retry-After") or headers.get("retry-after")
                if ra:
                    try:
                        retry_after_delay = int(ra)
                    except ValueError:
                        try:
                            target_dt = parsedate_to_datetime(ra)
                            diff = (target_dt - timezone.now()).total_seconds()
                            retry_after_delay = max(1, int(diff))
                        except Exception:
                            retry_after_delay = None

            elif 500 <= code < 600 or code == 0:
                # ─── Transient Server / Network Failure (Section 2 & 4) ─────
                delivery.status = NotificationStatus.RETRYING
                delivery.error_category = NotificationErrorCategory.SERVER_ERROR if code >= 500 else NotificationErrorCategory.NETWORK_ERROR
                delivery.error_detail = resp.get("text", f"Push gateway error {code}")
                delivery.save()

                any_retrying = True
                all_expired = False
                last_error_cat = delivery.error_category
                last_error_msg = delivery.error_detail

            else:
                # ─── Permanent Client / Authorization Error ─────────────────
                delivery.status = NotificationStatus.PERMANENTLY_FAILED
                delivery.error_category = NotificationErrorCategory.CLIENT_ERROR
                delivery.error_detail = resp.get("text", f"Push client error {code}")
                delivery.save()

                all_expired = False
                last_error_cat = NotificationErrorCategory.CLIENT_ERROR
                last_error_msg = delivery.error_detail

        # ─── Update Aggregate Notification Status ────────────────────────────
        with transaction.atomic():
            n = Notification.objects.select_for_update().filter(id=notification_id).first()
            if not n:
                return None

            if any_accepted:
                # At least one device push accepted
                n.status = NotificationStatus.PUSH_ACCEPTED
                n.push_accepted_at = timezone.now()
                n.next_retry_at = None
                n.last_error_category = None
                n.last_error_detail = None
                n.save()
                logger.info("Notification ID=%s successfully transitioned to PUSH_ACCEPTED.", notif.id)
                return n

            if any_retrying:
                if n.attempt_count >= max_retries:
                    # Bounded retries exhausted
                    n.status = NotificationStatus.PERMANENTLY_FAILED
                    n.next_retry_at = None
                    n.last_error_category = last_error_cat or NotificationErrorCategory.SERVER_ERROR
                    n.last_error_detail = f"Exhausted {max_retries} attempts: {last_error_msg}"
                    n.save()
                    logger.warning("Notification ID=%s transitioned to PERMANENTLY_FAILED (retries exhausted).", notif.id)
                    return n
                else:
                    # Calculate exponential backoff with jitter (Section 4)
                    if retry_after_delay:
                        delay = min(max_delay, max(1, retry_after_delay))
                    else:
                        exp = base_delay * (2 ** (n.attempt_count - 1))
                        jitter = random.uniform(0, 0.5 * exp)
                        delay = min(max_delay, int(exp + jitter))

                    n.status = NotificationStatus.RETRYING
                    n.next_retry_at = timezone.now() + timedelta(seconds=delay)
                    n.last_error_category = last_error_cat or NotificationErrorCategory.SERVER_ERROR
                    n.last_error_detail = last_error_msg
                    n.save()

                    logger.info("Notification ID=%s scheduled for retry in %ss (attempt %s/%s).",
                                notif.id, delay, n.attempt_count, max_retries)
                    cls.schedule_dispatch(n.id, countdown=delay)
                    return n

            if all_expired:
                n.status = NotificationStatus.EXPIRED
                n.next_retry_at = None
                n.last_error_category = NotificationErrorCategory.EXPIRED_SUBSCRIPTION
                n.last_error_detail = "All user push subscriptions expired or are invalid."
                n.save()
                logger.info("Notification ID=%s marked EXPIRED (all subscriptions invalid).", notif.id)
                return n

            # Permanent failure
            n.status = NotificationStatus.PERMANENTLY_FAILED
            n.next_retry_at = None
            n.last_error_category = last_error_cat or NotificationErrorCategory.CLIENT_ERROR
            n.last_error_detail = last_error_msg or "Unrecoverable delivery error."
            n.save()
            logger.warning("Notification ID=%s marked PERMANENTLY_FAILED.", notif.id)
            return n

    @classmethod
    def recover_stale_and_pending_jobs(cls):
        """
        Outbox and Stale Worker Recovery Engine (Section 2 & 4).
        Recovers:
        1. Jobs stuck in SENDING > STALE_TIMEOUT (worker killed/restarted mid-send)
        2. Scheduled retries ready for re-attempt (next_retry_at <= now)
        3. Unscheduled outbox records (status in CREATED, QUEUED > 60s old)
        """
        now = timezone.now()
        stale_timeout = getattr(settings, 'NOTIFICATION_STALE_TIMEOUT_SECONDS', 300)
        stale_threshold = now - timedelta(seconds=stale_timeout)
        recovered_count = 0

        # 1. Stale SENDING recovery
        stale_sending = Notification.objects.filter(
            status=NotificationStatus.SENDING,
            last_attempt_at__lt=stale_threshold
        )
        for notif in stale_sending[:50]:
            logger.warning("Recovering stale SENDING job ID=%s (last attempt: %s)", notif.id, notif.last_attempt_at)
            Notification.objects.filter(id=notif.id).update(status=NotificationStatus.QUEUED)
            cls.schedule_dispatch(notif.id)
            recovered_count += 1

        # 2. Due RETRYING jobs
        due_retries = Notification.objects.filter(
            status=NotificationStatus.RETRYING,
            next_retry_at__lte=now
        )
        for notif in due_retries[:50]:
            logger.info("Processing due retry for Notification ID=%s", notif.id)
            cls.schedule_dispatch(notif.id)
            recovered_count += 1

        # 3. Unscheduled or interrupted CREATED / QUEUED jobs older than 60s
        pending_outbox = Notification.objects.filter(
            status__in=[NotificationStatus.CREATED, NotificationStatus.QUEUED],
            created_at__lt=now - timedelta(seconds=60)
        )
        for notif in pending_outbox[:50]:
            logger.info("Dispatching pending outbox notification ID=%s", notif.id)
            cls.schedule_dispatch(notif.id)
            recovered_count += 1

        return recovered_count

    @classmethod
    def retry_notification(cls, notification_id, reset_count=False):
        """
        Administrative Safe Retry (Section 4 & 9).
        Allows administrators to safely re-queue eligible failed or expired notifications.
        """
        with transaction.atomic():
            notif = Notification.objects.select_for_update().filter(id=notification_id).first()
            if not notif:
                return False, "Notification not found."

            if notif.status not in [NotificationStatus.PERMANENTLY_FAILED, NotificationStatus.RETRYING, NotificationStatus.EXPIRED]:
                return False, f"Notification is currently in '{notif.status}' status and cannot be manually retried."

            notif.status = NotificationStatus.QUEUED
            notif.next_retry_at = None
            if reset_count:
                notif.attempt_count = 0
            notif.save(update_fields=['status', 'next_retry_at', 'attempt_count', 'updated_at'])

        cls.schedule_dispatch(notif.id)
        return True, "Notification successfully re-queued for delivery."
