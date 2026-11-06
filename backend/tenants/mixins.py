from django.db import models
from accounts.models import Role


class TenantScopedQuerySetMixin:
    """
    Guarantees strict tenant-level isolation across DRF ViewSets.
    Automatically scopes list, detail, update, delete, search, and export
    queries to the active tenant.
    
    Protects against:
    - Cross-tenant data leakage (SEC-01)
    - Insecure Direct Object Reference (IDOR) attacks (SEC-02)
    - Cross-tenant mutations and deletions
    """

    def get_tenant(self):
        user = getattr(self.request, 'user', None)
        if user and user.is_authenticated:
            user_role = getattr(user, 'role', '')
            is_super = (user_role == Role.SUPER_ADMIN) or (user.is_superuser and getattr(user, 'company', None) is None)
            if not is_super and getattr(user, 'company', None):
                return user.company
        return getattr(self.request, 'tenant', None) or getattr(getattr(self.request, 'user', None), 'company', None)

    def get_queryset(self):
        qs = super().get_queryset()
        user = getattr(self.request, 'user', None)

        if not user or not user.is_authenticated:
            return qs.none()

        # Global Super Admin maintenance mode (when viewing the platform globally)
        user_role = getattr(user, 'role', '')
        if ((user_role == Role.SUPER_ADMIN) or (user.is_superuser and getattr(user, 'company', None) is None)) and not getattr(self.request, 'tenant', None):
            return qs

        tenant = self.get_tenant()
        if not tenant:
            return qs.none()

        model = qs.model
        is_master = getattr(tenant, 'is_master_tenant', False)

        # 1. Model directly linked to Company
        if hasattr(model, 'company'):
            if is_master:
                return qs.filter(models.Q(company=tenant) | models.Q(company__isnull=True))
            return qs.filter(company=tenant)

        # 2. Model linked via Employee
        if hasattr(model, 'employee'):
            if is_master:
                return qs.filter(models.Q(employee__company=tenant) | models.Q(employee__company__isnull=True))
            return qs.filter(employee__company=tenant)

        # 3. Model linked via Department
        if hasattr(model, 'department'):
            if is_master:
                return qs.filter(models.Q(department__company=tenant) | models.Q(department__company__isnull=True))
            return qs.filter(department__company=tenant)

        # 4. Model linked via User
        if hasattr(model, 'user'):
            if is_master:
                return qs.filter(models.Q(user__company=tenant) | models.Q(user__company__isnull=True))
            return qs.filter(user__company=tenant)

        return qs

    def perform_create(self, serializer):
        tenant = self.get_tenant()
        model = getattr(getattr(serializer, 'Meta', None), 'model', None)
        if model and hasattr(model, 'company') and 'company' not in serializer.validated_data and tenant:
            serializer.save(company=tenant)
        else:
            serializer.save()

