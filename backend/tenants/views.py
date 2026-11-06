from decimal import Decimal
from datetime import date, timedelta
from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Sum, Count, Q

from tenants.models import (
    Company, SubscriptionPlan, CompanySubscription,
    TenantDomain, CompanySetting, CompanyStatus, SubscriptionStatus
)
from tenants.serializers import (
    CompanySerializer, SubscriptionPlanSerializer,
    CompanySubscriptionSerializer, CompanySettingSerializer,
    CompanyOnboardingSerializer
)
from tenants.permissions import IsSuperAdmin, IsCompanyAdmin
from audit.services import AuditService


class SuperAdminDashboardStatsView(APIView):
    """
    Provides high-level SaaS platform telemetry, usage counters, and revenue metrics
    exclusively for the SaaS Platform Super Admin dashboard.
    """
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        from employees.models import Employee

        today = date.today()
        upcoming_cutoff = today + timedelta(days=14)

        total_companies = Company.objects.count()
        active_companies = Company.objects.filter(status=CompanyStatus.ACTIVE).count()
        suspended_companies = Company.objects.filter(status=CompanyStatus.SUSPENDED).count()

        total_employees = Employee.all_objects.count() if hasattr(Employee, 'all_objects') else Employee.objects.count()

        active_subs = CompanySubscription.objects.filter(
            status__in=[SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.GRACE_PERIOD]
        )
        active_subscriptions_count = active_subs.count()
        expiring_soon_count = active_subs.filter(expiry_date__range=[today, upcoming_cutoff]).count()

        # Monthly Recurring Revenue (MRR) projection
        mrr = Decimal('0.00')
        for sub in active_subs.select_related('plan'):
            if sub.plan:
                if sub.plan.billing_cycle == 'MONTHLY':
                    mrr += sub.plan.price_inr
                elif sub.plan.billing_cycle == 'YEARLY':
                    mrr += (sub.plan.price_inr / Decimal('12.0')).quantize(Decimal('0.01'))
                elif sub.plan.billing_cycle == 'QUARTERLY':
                    mrr += (sub.plan.price_inr / Decimal('3.0')).quantize(Decimal('0.01'))

        plan_breakdown = list(
            CompanySubscription.objects.values('plan__tier', 'plan__name')
            .annotate(company_count=Count('id'))
            .order_by('-company_count')
        )

        return Response({
            'total_companies': total_companies,
            'active_companies': active_companies,
            'suspended_companies': suspended_companies,
            'total_registered_employees': total_employees,
            'total_employees': total_employees,
            'active_subscriptions': active_subscriptions_count,
            'expiring_subscriptions_count': expiring_soon_count,
            'projected_mrr_inr': float(mrr),
            'mrr_inr': float(mrr),
            'plan_breakdown': plan_breakdown,
        })


class CompanyManagementViewSet(viewsets.ModelViewSet):
    """
    Super Admin management endpoints to create, monitor, suspend, and configure
    all customer tenant organizations.
    """
    queryset = Company.objects.all().order_by('-created_at')
    serializer_class = CompanySerializer
    permission_classes = [IsSuperAdmin]

    @action(detail=False, methods=['post'], url_path='onboard')
    def onboard_company(self, request):
        """
        Onboards a new customer organization, assigning its subscription and creating
        the primary company administrator account.
        """
        serializer = CompanyOnboardingSerializer(data=request.data)
        if serializer.is_valid():
            company = serializer.save()
            AuditService.log_action(
                actor=request.user,
                action='COMPANY_ONBOARDED',
                target_model='Company',
                target_id=str(company.id),
                new_values={'name': company.name, 'slug': company.slug},
                reason=f"Company {company.name} successfully provisioned on platform",
                request=request
            )
            return Response(CompanySerializer(company).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='suspend')
    def suspend_company(self, request, pk=None):
        company = self.get_object()
        if company.is_master_tenant:
            return Response({'error': 'The master enterprise tenant cannot be suspended.'}, status=status.HTTP_400_BAD_REQUEST)

        company.status = CompanyStatus.SUSPENDED
        company.save(update_fields=['status'])

        if hasattr(company, 'subscription'):
            company.subscription.status = SubscriptionStatus.SUSPENDED
            company.subscription.save(update_fields=['status'])

        AuditService.log_action(
            actor=request.user,
            action='COMPANY_SUSPENDED',
            target_model='Company',
            target_id=str(company.id),
            reason=request.data.get('reason', 'Administrative suspension by Super Admin'),
            request=request
        )
        return Response({'status': 'Company suspended successfully', 'company': CompanySerializer(company).data})

    @action(detail=True, methods=['post'], url_path='activate')
    def activate_company(self, request, pk=None):
        company = self.get_object()
        company.status = CompanyStatus.ACTIVE
        company.save(update_fields=['status'])

        if hasattr(company, 'subscription'):
            company.subscription.status = SubscriptionStatus.ACTIVE
            company.subscription.save(update_fields=['status'])

        AuditService.log_action(
            actor=request.user,
            action='COMPANY_ACTIVATED',
            target_model='Company',
            target_id=str(company.id),
            reason='Activated by Super Admin',
            request=request
        )
        return Response({'status': 'Company activated successfully', 'company': CompanySerializer(company).data})

    @action(detail=True, methods=['post'], url_path='toggle-maintenance')
    def toggle_maintenance(self, request, pk=None):
        company = self.get_object()
        company.has_maintenance_module = not company.has_maintenance_module
        company.save(update_fields=['has_maintenance_module'])

        AuditService.log_action(
            actor=request.user,
            action='MAINTENANCE_MODULE_TOGGLED',
            target_model='Company',
            target_id=str(company.id),
            new_values={'has_maintenance_module': company.has_maintenance_module},
            reason=f"Maintenance Ops module set to {company.has_maintenance_module} by Super Admin",
            request=request
        )
        return Response({
            'status': f"Maintenance Ops {'enabled' if company.has_maintenance_module else 'disabled'} successfully",
            'has_maintenance_module': company.has_maintenance_module,
            'company': CompanySerializer(company).data
        })


class SubscriptionPlanViewSet(viewsets.ModelViewSet):
    """
    CRUD for SaaS subscription plan configurations.
    Read-only for authenticated users; write-restricted to Super Admin.
    """
    queryset = SubscriptionPlan.objects.all().order_by('price_inr')
    serializer_class = SubscriptionPlanSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsSuperAdmin()]
        return [permissions.IsAuthenticated()]


class CompanySubscriptionViewSet(viewsets.ModelViewSet):
    """
    Super Admin endpoints to modify subscription parameters, extend validity,
    or upgrade plan tiers.
    """
    queryset = CompanySubscription.objects.all().select_related('company', 'plan').order_by('-created_at')
    serializer_class = CompanySubscriptionSerializer
    permission_classes = [IsSuperAdmin]

    @action(detail=True, methods=['post'], url_path='extend-validity')
    def extend_validity(self, request, pk=None):
        sub = self.get_object()
        days_to_add = int(request.data.get('days', 30))
        sub.expiry_date = sub.expiry_date + timedelta(days=days_to_add)
        sub.status = SubscriptionStatus.ACTIVE
        sub.save(update_fields=['expiry_date', 'status'])
        return Response(CompanySubscriptionSerializer(sub).data)


class TenantProfileView(APIView):
    """
    Allows Company Administrators to manage their own company profile and branding.
    """
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    permission_classes = [IsCompanyAdmin]

    def get(self, request):
        tenant = getattr(request, 'tenant', None) or getattr(request.user, 'company', None)
        if not tenant:
            return Response({'error': 'No active company tenant identified.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(CompanySerializer(tenant).data)

    def patch(self, request):
        tenant = getattr(request, 'tenant', None) or getattr(request.user, 'company', None)
        if not tenant:
            return Response({'error': 'No active company tenant identified.'}, status=status.HTTP_404_NOT_FOUND)

        # Update Company contact details
        comp_serializer = CompanySerializer(tenant, data=request.data, partial=True)
        if comp_serializer.is_valid():
            comp_serializer.save()

        # Update Company Settings / Branding
        setting_obj, _ = CompanySetting.objects.get_or_create(company=tenant)
        setting_serializer = CompanySettingSerializer(setting_obj, data=request.data, partial=True)
        if setting_serializer.is_valid():
            setting_serializer.save()

        return Response(CompanySerializer(tenant).data)


class TenantPublicInfoView(APIView):
    """
    Public unauthenticated endpoint to fetch company branding (logo, name, brand color)
    given a company slug. Powers dynamic branding on login screens.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        slug = request.query_params.get('slug', '').strip().lower()
        if not slug:
            # Fall back to master tenant (Tenant 1)
            company = Company.objects.filter(is_master_tenant=True).first() or Company.objects.first()
        else:
            company = Company.objects.filter(slug=slug, status=CompanyStatus.ACTIVE).first()

        if not company:
            return Response({'error': 'Company not found'}, status=status.HTTP_404_NOT_FOUND)

        settings = getattr(company, 'settings', None)
        logo_url = None
        brand_color = '#2563eb'
        tagline = 'Secure Enterprise Workspace Portal'
        if settings:
            if settings.company_logo:
                try:
                    logo_url = settings.company_logo.url
                except Exception:
                    logo_url = None
            brand_color = settings.brand_color or '#2563eb'
            tagline = settings.company_tagline or tagline

        return Response({
            'company_id': str(company.id),
            'company_name': company.name,
            'slug': company.slug,
            'logo': logo_url,
            'brand_color': brand_color,
            'tagline': tagline,
            'status': company.status
        })

