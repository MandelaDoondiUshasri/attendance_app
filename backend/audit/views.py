from tenants.utils import get_authoritative_tenant
from rest_framework import viewsets
from django.db.models import Q
from audit.models import AuditLog
from audit.serializers import AuditLogSerializer
from accounts.permissions import IsCEO
from accounts.models import Role


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all().order_by('-timestamp')
    serializer_class = AuditLogSerializer
    permission_classes = [IsCEO]

    def get_queryset(self):
        user = self.request.user
        tenant = get_authoritative_tenant(self.request)
        is_master = (getattr(tenant, 'is_master_tenant', False) or getattr(tenant, 'slug', '') == 'frg') if tenant else False

        queryset = AuditLog.objects.all().order_by('-timestamp')

        # Global Super Admin can see global audit trail
        if (getattr(user, 'role', '') == Role.SUPER_ADMIN or user.is_superuser) and not tenant:
            pass
        elif tenant:
            if is_master:
                queryset = queryset.filter(Q(actor__company=tenant) | Q(actor__company__isnull=True))
            else:
                queryset = queryset.filter(actor__company=tenant)
        else:
            queryset = queryset.none()

        action_param = self.request.query_params.get('action')
        actor_param = self.request.query_params.get('actor')

        if action_param:
            queryset = queryset.filter(action__icontains=action_param)
        if actor_param:
            queryset = queryset.filter(actor__email__icontains=actor_param)

        return queryset
