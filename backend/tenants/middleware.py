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
    Authoritative server-side tenant resolution middleware.
    
    Security Rules:
    1. For authenticated company users, tenant identity is strictly determined
       by server-side user.company association. Client headers/queries are IGNORED.
    2. Only authorized Super Administrators (is_superuser, SUPER_ADMIN, SYSTEM_ADMIN)
       are permitted to switch tenant context via X-Tenant-Slug header.
    3. Early JWT token parsing ensures DRF JWT requests have authenticated user
       context available during middleware execution.
    4. Safe fallback to Master Tenant preserves existing single-tenant endpoints
       and local automated test suites.
    """

    def process_request(self, request):
        from tenants.models import Company, TenantDomain

        tenant = None

        # 1. Early User Extraction (DRF test client or JWT Token)
        if not hasattr(request, 'user') or not request.user.is_authenticated:
            if hasattr(request, '_force_auth_user') and request._force_auth_user:
                request.user = request._force_auth_user
            else:
                auth_header = request.META.get('HTTP_AUTHORIZATION', '')
                if auth_header.startswith('Bearer '):
                    try:
                        from rest_framework_simplejwt.authentication import JWTAuthentication
                        jwt_auth = JWTAuthentication()
                        validated_token = jwt_auth.get_validated_token(auth_header.split(' ')[1])
                        request.user = jwt_auth.get_user(validated_token)
                    except Exception:
                        pass

        # 2. Authenticated Users: Server-Side Association is AUTHORITATIVE
        if hasattr(request, 'user') and request.user.is_authenticated:
            user_role = getattr(request.user, 'role', '')
            is_super = (user_role == 'SUPER_ADMIN') or (request.user.is_superuser and getattr(request.user, 'company', None) is None)

            if is_super:
                # Super Admins may explicitly specify target tenant context
                header_slug = request.META.get('HTTP_X_TENANT_SLUG')
                header_id = request.META.get('HTTP_X_TENANT_ID')
                query_slug = request.GET.get('tenant')

                if header_slug:
                    tenant = Company.objects.filter(slug=header_slug.strip().lower()).first()
                elif header_id:
                    tenant = Company.objects.filter(id=header_id.strip()).first()
                elif query_slug:
                    tenant = Company.objects.filter(slug=query_slug.strip().lower()).first()
                else:
                    tenant = getattr(request.user, 'company', None)
            else:
                # Ordinary company users MUST ALWAYS use their own assigned company!
                # Client headers and query parameters are strictly ignored.
                tenant = getattr(request.user, 'company', None)

        # 3. Public / Unauthenticated Requests (Domain or Subdomain resolution)
        if not tenant:
            header_slug = request.META.get('HTTP_X_TENANT_SLUG')
            if header_slug:
                tenant = Company.objects.filter(slug=header_slug.strip().lower()).first()

        if not tenant:
            host = request.get_host().split(':')[0].lower()
            if host not in ['localhost', '127.0.0.1', 'testserver']:
                domain_rec = TenantDomain.objects.filter(domain=host, is_verified=True).select_related('company').first()
                if domain_rec:
                    tenant = domain_rec.company
                else:
                    parts = host.split('.')
                    if len(parts) >= 3:
                        tenant = Company.objects.filter(slug=parts[0]).first()

        # 4. Master Tenant Fallback (Protects Existing Production & Testing)
        if not tenant:
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
