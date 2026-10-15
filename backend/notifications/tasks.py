import logging
from celery import shared_task
from notifications.services import NotificationService

logger = logging.getLogger('notifications')


@shared_task(
    bind=True,
    name='notifications.tasks.process_notification_job',
    max_retries=None,  # We manage application-level exponential backoff with durable DB state
    ignore_result=True
)
def process_notification_job(self, notification_id):
    """
    Durable Celery task to process a single notification.
    Ensures safe execution, concurrency protection, and recovery.
    """
    try:
        NotificationService.dispatch_notification(notification_id)
    except Exception as exc:
        logger.exception("Unexpected error in process_notification_job for ID=%s: %s", notification_id, exc)


@shared_task(
    name='notifications.tasks.scan_and_recover_outbox_job',
    ignore_result=True
)
def scan_and_recover_outbox_job():
    """
    Periodic background job to scan and recover stale or pending outbox records.
    Recovers work after worker restarts or deployment interruptions (Section 2 & 4).
    """
    try:
        recovered = NotificationService.recover_stale_and_pending_jobs()
        if recovered > 0:
            logger.info("Outbox scanner recovered %d notification jobs.", recovered)
    except Exception as exc:
        logger.exception("Error during scan_and_recover_outbox_job: %s", exc)
