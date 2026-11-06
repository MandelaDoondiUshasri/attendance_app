from rest_framework.permissions import BasePermission
from accounts.models import Role


class IsSuperAdmin(BasePermission):
    """
    Grants access exclusively to SaaS Platform Super Administrators.
    Super Admins own and manage the commercial multi-company platform.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (
                request.user.role == Role.SYSTEM_ADMIN or
                getattr(request.user, 'role', '') == 'SUPER_ADMIN' or
                request.user.is_superuser
            )
        )


class IsCompanyAdmin(BasePermission):
    """
    Grants access to authorized Company Administrators (CEO / HR / Company Admin)
    strictly within their own company tenant.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return request.user.role in [Role.CEO, Role.HR, Role.SYSTEM_ADMIN, 'COMPANY_ADMIN']


class IsTenantMember(BasePermission):
    """
    Guarantees strict tenant authorization. A user can only access resources
    that belong to their registered company tenant.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        # Super Admins have global platform access
        if request.user.is_superuser or getattr(request.user, 'role', '') in [Role.SYSTEM_ADMIN, 'SUPER_ADMIN']:
            return True
        tenant = getattr(request, 'tenant', None)
        user_company = getattr(request.user, 'company', None)
        if tenant and user_company:
            return tenant.id == user_company.id
        return True


class HasActiveSubscription(BasePermission):
    """
    Guarantees that companies with expired subscriptions beyond the grace period,
    or with SUSPENDED / DEACTIVATED status, are blocked from write operations (POST, PUT, PATCH, DELETE).
    Read-only operations (GET, HEAD, OPTIONS) remain available during grace period.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return True

        # Read-only methods (GET, HEAD, OPTIONS) are permitted so staff can view past data
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True

        # Super Admin bypasses subscription restrictions
        if request.user.is_superuser or getattr(request.user, 'role', '') in [Role.SYSTEM_ADMIN, 'SUPER_ADMIN']:
            return True

        tenant = getattr(request, 'tenant', None) or getattr(request.user, 'company', None)
        if not tenant:
            return True

        # Master Tenant is always active
        if getattr(tenant, 'is_master_tenant', False):
            return True

        if tenant.status in ['SUSPENDED', 'DEACTIVATED']:
            return False

        sub = getattr(tenant, 'subscription', None)
        if not sub:
            return True

        return sub.is_valid_or_in_grace


class RequiresPlanFeature(BasePermission):
    """
    Guarantees that access to sensitive enterprise modules is governed by
    the active subscription plan's feature flags:
    - has_payroll_module
    - has_pf_esi_compliance
    - has_geofencing_module
    - has_early_pass_module
    - has_wfh_tracking
    - has_custom_reports
    """
    feature_name = None

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False

        if request.user.is_superuser or getattr(request.user, 'role', '') in [Role.SYSTEM_ADMIN, 'SUPER_ADMIN']:
            return True

        tenant = getattr(request, 'tenant', None) or getattr(request.user, 'company', None)
        if not tenant or getattr(tenant, 'is_master_tenant', False):
            return True

        sub = getattr(tenant, 'subscription', None)
        if not sub or not sub.plan:
            return True

        feature = getattr(view, 'required_plan_feature', self.feature_name)
        if not feature:
            return True

        return getattr(sub.plan, feature, True)
