from rest_framework import serializers
from audit.models import AuditLog

class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.CharField(source='actor.email', read_only=True, default='SYSTEM')
    actor_role = serializers.CharField(source='actor.role', read_only=True, default='SYSTEM')

    class Meta:
        model = AuditLog
        fields = ['id', 'actor', 'actor_email', 'actor_role', 'action', 'target_model', 'target_id', 'old_values', 'new_values', 'reason', 'ip_address', 'device_info', 'timestamp']
