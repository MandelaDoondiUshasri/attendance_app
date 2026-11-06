from accounts.models import Role
from tenants.models import Company


def get_authoritative_tenant(request):
    """
    Returns the authoritative Company tenant for the given request.
    
    Strict Security Priority:
    1. For authenticated users associated with a specific company, user.company
       is ALWAYS authoritative. This prevents cross-tenant data leakage caused
       by unauthenticated middleware fallbacks or public host matching.
    2. For SaaS Super Admins (with company=None), allow switching tenant context
       via X-Tenant-Slug header, query param, or request.tenant.
    3. For unauthenticated requests, use request.tenant if resolved by domain/subdomain,
       otherwise None.
    """
    if not request:
        return None

    user = getattr(request, 'user', None)
    if user and user.is_authenticated:
        user_role = getattr(user, 'role', '')
        is_super = (user_role == Role.SUPER_ADMIN) or (user.is_superuser and getattr(user, 'company', None) is None)
        if not is_super:
            user_company = getattr(user, 'company', None)
            if user_company:
                return user_company

        # Super Admin context switching
        header_slug = request.META.get('HTTP_X_TENANT_SLUG')
        if header_slug:
            comp = Company.objects.filter(slug=header_slug.strip().lower()).first()
            if comp:
                return comp

        query_slug = request.GET.get('tenant')
        if query_slug:
            comp = Company.objects.filter(slug=query_slug.strip().lower()).first()
            if comp:
                return comp

        return getattr(request, 'tenant', None)

    return getattr(request, 'tenant', None)
