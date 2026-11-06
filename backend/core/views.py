import os
from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from core.models import OrganizationSettings, Holiday
from core.serializers import OrganizationSettingsSerializer, HolidaySerializer
from accounts.permissions import IsCEO, IsHR
from tenants.mixins import TenantScopedQuerySetMixin
from tenants.models import CompanySetting

class SettingsView(APIView):
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH']:
            return [IsHR()]
        return [permissions.AllowAny()]

    def get_tenant(self, request):
        user = getattr(request, 'user', None)
        if user and user.is_authenticated:
            if getattr(user, 'company', None):
                return user.company
        return getattr(request, 'tenant', None)

    def get(self, request):
        tenant = self.get_tenant(request)

        if tenant and not getattr(tenant, 'is_master_tenant', False):
            comp_setting, _ = CompanySetting.objects.get_or_create(
                company=tenant,
                defaults={
                    'company_tagline': f"{tenant.name} Workspace Portal",
                }
            )
            logo_url = None
            if comp_setting.company_logo:
                try:
                    logo_url = comp_setting.company_logo.url
                except Exception:
                    logo_url = None

            return Response({
                'id': str(tenant.id),
                'company_name': tenant.name,
                'company_logo': logo_url,
                'company_tagline': comp_setting.company_tagline or f"{tenant.name} Workspace Portal",
                'company_address': tenant.address or '',
                'contact_email': tenant.contact_email,
                'contact_phone': tenant.contact_phone,
                'office_start_time': comp_setting.office_start_time,
                'office_end_time': comp_setting.office_end_time,
                'grace_period_minutes': comp_setting.grace_period_minutes,
                'required_working_hours': str(comp_setting.required_working_hours),
                'half_day_threshold_hours': str(comp_setting.half_day_threshold_hours),
                'salary_denominator_policy': comp_setting.salary_denominator_policy,
                'optional_leave_annual_entitlement': comp_setting.optional_leave_annual_entitlement,
                'casual_leave_annual_entitlement': comp_setting.casual_leave_annual_entitlement,
                'standard_daily_work_hours': str(comp_setting.required_working_hours),
                'early_pass_max_per_month': comp_setting.early_pass_max_per_month,
                'early_pass_min_working_hours': str(comp_setting.early_pass_min_working_hours),
                'early_pass_allow_same_day': comp_setting.early_pass_allow_same_day,
                'early_pass_require_advance': False,
                'early_pass_allow_cancellation': True,
                'early_pass_attachment_mandatory': False,
                'early_pass_approval_role': comp_setting.early_pass_approval_role,
                'updated_at': comp_setting.updated_at.isoformat() if comp_setting.updated_at else None,
            })

        settings_obj = OrganizationSettings.get_settings()
        return Response(OrganizationSettingsSerializer(settings_obj).data)

    def patch(self, request):
        tenant = self.get_tenant(request)

        if tenant and not getattr(tenant, 'is_master_tenant', False):
            comp_setting, _ = CompanySetting.objects.get_or_create(company=tenant)

            # Update tenant company details
            if 'company_name' in request.data and request.data['company_name']:
                tenant.name = request.data['company_name']
            if 'contact_email' in request.data:
                tenant.contact_email = request.data['contact_email']
            if 'contact_phone' in request.data:
                tenant.contact_phone = request.data['contact_phone']
            if 'company_address' in request.data:
                tenant.address = request.data['company_address']
            tenant.save()

            # Support removing company logo
            if request.data.get('remove_logo') in ['true', True, '1']:
                if comp_setting.company_logo:
                    try:
                        if hasattr(comp_setting.company_logo, 'path') and os.path.exists(comp_setting.company_logo.path):
                            os.remove(comp_setting.company_logo.path)
                    except Exception:
                        pass
                    comp_setting.company_logo = None

            # Handle company logo upload
            if 'company_logo' in request.FILES:
                comp_setting.company_logo = request.FILES['company_logo']

            # Update tenant operational settings
            for field in [
                'company_tagline', 'office_start_time', 'office_end_time',
                'grace_period_minutes', 'required_working_hours', 'half_day_threshold_hours',
                'salary_denominator_policy', 'optional_leave_annual_entitlement',
                'casual_leave_annual_entitlement', 'early_pass_max_per_month',
                'early_pass_min_working_hours', 'early_pass_allow_same_day',
                'early_pass_approval_role'
            ]:
                if field in request.data:
                    setattr(comp_setting, field, request.data[field])

            comp_setting.save()

            # Dynamically invalidate cached payslip PDFs
            try:
                from salaries.models import Payslip
                Payslip.objects.filter(employee__company=tenant).update(pdf_file=None)
            except Exception:
                pass

            return self.get(request)

        settings_obj = OrganizationSettings.get_settings()

        # Support removing company logo if explicitly requested
        if request.data.get('remove_logo') in ['true', True, '1']:
            if settings_obj.company_logo:
                try:
                    if hasattr(settings_obj.company_logo, 'path') and os.path.exists(settings_obj.company_logo.path):
                        os.remove(settings_obj.company_logo.path)
                except Exception:
                    pass
                settings_obj.company_logo = None
                settings_obj.save(update_fields=['company_logo'])

        serializer = OrganizationSettingsSerializer(settings_obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()

            # Dynamically invalidate cached payslip PDFs so subsequent views/downloads use the new company details & logo
            try:
                from salaries.models import Payslip
                Payslip.objects.all().update(pdf_file=None)
            except Exception:
                pass

            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class HolidayViewSet(TenantScopedQuerySetMixin, viewsets.ModelViewSet):
    queryset = Holiday.objects.all().order_by('date')
    serializer_class = HolidaySerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsHR()]
        return [permissions.IsAuthenticated()]
