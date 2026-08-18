from audit.models import AuditLog

class AuditService:
    @staticmethod
    def log_action(actor, action, target_model=None, target_id=None, old_values=None, new_values=None, reason=None, request=None):
        ip_address = None
        device_info = None

        if request:
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                ip_address = x_forwarded_for.split(',')[0].strip()
            else:
                ip_address = request.META.get('REMOTE_ADDR')
            device_info = request.META.get('HTTP_USER_AGENT', '')[:250]

        return AuditLog.objects.create(
            actor=actor if (actor and hasattr(actor, 'is_authenticated') and actor.is_authenticated) else None,
            action=action,
            target_model=target_model,
            target_id=str(target_id) if target_id else None,
            old_values=old_values,
            new_values=new_values,
            reason=reason,
            ip_address=ip_address,
            device_info=device_info
        )
