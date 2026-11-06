from accounts.models import Role
from tenants.models import Company


def get_authoritative_tenant(request):
    """
    Returns the authoritative Company tenant for the given request.
    
    Security & Multi-Tenant Rules:
    1. For authenticated users associated with a specific company, user.company
       is ALWAYS authoritative. This guarantees First Care Pharmacy and any other
       tenant NEVER receives data from other companies.
    2. For SaaS Super Admins (with company=None), allow switching tenant context
       via X-Tenant-Slug header, query param, or request.tenant.
    3. For authenticated users whose company is None (legacy single-tenant records
       or legacy test cases), fallback to Master Tenant (FRG) so legacy single-tenant
       functionality and automated test suites remain 100% operational.
    4. For unauthenticated requests, check X-Tenant-Slug header or request.tenant.
    """
    if not request:
        return None

    user = getattr(request, 'user', None)
    if user and user.is_authenticated:
        user_role = getattr(user, 'role', '')
        is_super = (user_role == Role.SUPER_ADMIN) or (user.is_superuser and getattr(user, 'company', None) is None)
        
        # 1. Company-associated user: ALWAYS authoritative
        user_company = getattr(user, 'company', None)
        if user_company:
            return user_company

        # 2. Super Admin context switching
        if is_super:
            header_slug = request.META.get('HTTP_X_TENANT_SLUG') if hasattr(request, 'META') else None
            if header_slug:
                comp = Company.objects.filter(slug=header_slug.strip().lower()).first()
                if comp:
                    return comp

            query_slug = request.GET.get('tenant') if hasattr(request, 'GET') else None
            if query_slug:
                comp = Company.objects.filter(slug=query_slug.strip().lower()).first()
                if comp:
                    return comp

            return getattr(request, 'tenant', None)

        # 3. Authenticated user without explicit company:
        # Fall back to Master Tenant (FRG) for backwards compatibility
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            tenant = Company.objects.filter(is_master_tenant=True).first()
            if not tenant:
                tenant = Company.objects.filter(slug='frg').first()
            if not tenant:
                tenant = Company.objects.first()
        return tenant

    # 4. Unauthenticated requests
    header_slug = request.META.get('HTTP_X_TENANT_SLUG') if hasattr(request, 'META') else None
    if header_slug:
        comp = Company.objects.filter(slug=header_slug.strip().lower()).first()
        if comp:
            return comp

    return getattr(request, 'tenant', None)
