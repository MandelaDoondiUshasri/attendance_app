from rest_framework import viewsets
from audit.models import AuditLog
from audit.serializers import AuditLogSerializer
from accounts.permissions import IsCEO

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all().order_by('-timestamp')
    serializer_class = AuditLogSerializer
    permission_classes = [IsCEO]

    def get_queryset(self):
        queryset = AuditLog.objects.all().order_by('-timestamp')
        action_param = self.request.query_params.get('action')
        actor_param = self.request.query_params.get('actor')

        if action_param:
            queryset = queryset.filter(action__icontains=action_param)
        if actor_param:
            queryset = queryset.filter(actor__email__icontains=actor_param)

        return queryset
