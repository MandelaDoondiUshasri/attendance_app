import logging
from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from salaries.models import Payslip, PayslipStatus
from salaries.email_service import PayslipNotificationDispatcher

logger = logging.getLogger(__name__)


@receiver(pre_save, sender=Payslip)
def track_payslip_previous_status(sender, instance, **kwargs):
    """
    Track the previous status of a Payslip instance before saving
    to detect transitions to RELEASED.
    """
    if instance.pk:
        try:
            old_instance = Payslip.objects.filter(pk=instance.pk).values('status').first()
            instance._previous_status = old_instance['status'] if old_instance else None
        except Exception:
            instance._previous_status = None
    else:
        instance._previous_status = None


@receiver(post_save, sender=Payslip)
def auto_dispatch_payslip_release_notification(sender, instance, created, **kwargs):
    """
    AUTOMATED PAYSLIP DISPATCH:
    Whenever a payslip transitions to RELEASED (via API, Django Admin, Bulk Action, or Script),
    automatically and mandatorily dispatch both In-App alert and branded Email with attached PDF.
    """
    if instance.status == PayslipStatus.RELEASED:
        previous_status = getattr(instance, '_previous_status', None)

        # Trigger if newly created as RELEASED or transitioned to RELEASED from another status
        is_new_release = created or (previous_status and previous_status != PayslipStatus.RELEASED)

        # Also support an explicit re-trigger flag if set
        force_dispatch = getattr(instance, '_force_email_dispatch', False)

        if is_new_release or force_dispatch:
            emp_name = instance.employee.full_name if instance.employee else 'Employee'
            logger.info(
                f"[AUTO-PAYSLIP-DISPATCH] Payslip {instance.payslip_reference} released for {emp_name}. "
                f"Automating mandatory email and in-app notifications."
            )
            try:
                # Automated async dispatch
                PayslipNotificationDispatcher.notify_payslip_released(instance)
            except Exception as e:
                logger.error(f"[AUTO-PAYSLIP-DISPATCH] Failed automated dispatch for payslip {instance.id}: {e}", exc_info=True)
