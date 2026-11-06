from django.db import models
from tenants.middleware import get_current_tenant


class TenantQuerySet(models.QuerySet):
    def for_tenant(self, tenant):
        if not tenant:
            return self
        return self.filter(company=tenant)


class TenantManager(models.Manager):
    """
    Manager that automatically filters querysets by the thread-local active tenant.
    Can be bypassed using .unscoped() for Super Admin or background system jobs.
    """

    def get_queryset(self):
        qs = TenantQuerySet(self.model, using=self._db)
        tenant = get_current_tenant()
        if tenant is not None:
            if getattr(tenant, 'is_master_tenant', False):
                return qs.filter(models.Q(company=tenant) | models.Q(company__isnull=True))
            return qs.filter(company=tenant)
        return qs

    def unscoped(self):
        """
        Bypasses automatic tenant filtering, returning all records across all tenants.
        Reserved exclusively for Super Admin analytics or cross-company maintenance.
        """
        return TenantQuerySet(self.model, using=self._db)


class TenantAwareModel(models.Model):
    """
    Abstract base model providing tenant awareness and automatic query scoping.
    Nullable foreign key guarantees 100% backward compatibility for existing records.
    """
    company = models.ForeignKey(
        'tenants.Company',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        db_index=True,
        related_name='%(app_label)s_%(class)s_records'
    )

    objects = TenantManager()
    all_objects = models.Manager()

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self.company_id:
            tenant = get_current_tenant()
            if tenant:
                self.company = tenant
        super().save(*args, **kwargs)

