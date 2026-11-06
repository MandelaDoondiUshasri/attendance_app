import threading
from django.utils.deprecation import MiddlewareMixin

_thread_locals = threading.local()


def get_current_tenant():
    """
    Returns the currently active Company tenant for the current execution thread.
    """
    return getattr(_thread_locals, 'tenant', None)


def set_current_tenant(tenant):
    """
    Binds a Company tenant to the current execution thread.
    """
    _thread_locals.tenant = tenant


def clear_current_tenant():
    """
    Clears the tenant context from the thread local.
    """
    if hasattr(_thread_locals, 'tenant'):
        del _thread_locals.tenant


class TenantResolutionMiddleware(MiddlewareMixin):
    """
    Resolves and activates the appropriate customer tenant context for each request.
    Resolution Priority:
    1. Direct header: 'X-Tenant-Slug' or 'X-Tenant-ID'
    2. Authenticated user's company (request.user.company)
    3. Custom domain / subdomain resolution
    4. Query parameter (?tenant=slug)
    5. Fallback to Master Tenant (FRG Enterprise) for backward compatibility
    """

    def process_request(self, request):
        from tenants.models import Company, TenantDomain

        tenant = None

        # 1. Header Resolution
        tenant_slug = request.META.get('HTTP_X_TENANT_SLUG')
        tenant_id = request.META.get('HTTP_X_TENANT_ID')

        if tenant_slug:
            tenant = Company.objects.filter(slug=tenant_slug.strip().lower(), status__in=['ACTIVE', 'ONBOARDING']).first()
        elif tenant_id:
            tenant = Company.objects.filter(id=tenant_id.strip(), status__in=['ACTIVE', 'ONBOARDING']).first()

        # 2. Query Parameter Fallback (e.g. during dev/testing)
        if not tenant:
            query_slug = request.GET.get('tenant')
            if query_slug:
                tenant = Company.objects.filter(slug=query_slug.strip().lower(), status__in=['ACTIVE', 'ONBOARDING']).first()

        # 3. Domain / Subdomain Resolution
        if not tenant:
            host = request.get_host().split(':')[0].lower()
            # Ignore standard root localhost/ip domains
            if host not in ['localhost', '127.0.0.1', 'testserver']:
                domain_rec = TenantDomain.objects.filter(domain=host, is_verified=True).select_related('company').first()
                if domain_rec:
                    tenant = domain_rec.company
                else:
                    # Check subdomain: e.g. company-a.attendance.com
                    parts = host.split('.')
                    if len(parts) >= 3:
                        subdomain = parts[0]
                        tenant = Company.objects.filter(slug=subdomain, status__in=['ACTIVE', 'ONBOARDING']).first()

        # 4. Authenticated User's Company
        if not tenant and hasattr(request, 'user') and request.user.is_authenticated:
            user_company = getattr(request.user, 'company', None)
            if user_company:
                tenant = user_company

        # 5. Master Tenant Fallback (Protects Existing Production Application)
        if not tenant:
            # Fall back to master tenant (Tenant 1: FRG Enterprise)
            try:
                tenant = Company.objects.filter(is_master_tenant=True).first()
                if not tenant:
                    tenant = Company.objects.first()
            except Exception:
                tenant = None

        request.tenant = tenant
        set_current_tenant(tenant)

    def process_response(self, request, response):
        clear_current_tenant()
        if hasattr(request, 'tenant') and request.tenant:
            response['X-Tenant-Slug'] = request.tenant.slug
        return response

    def process_exception(self, request, exception):
        clear_current_tenant()

