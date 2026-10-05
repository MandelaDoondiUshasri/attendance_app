import os
from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from core.models import OrganizationSettings, Holiday
from core.serializers import OrganizationSettingsSerializer, HolidaySerializer
from accounts.permissions import IsCEO, IsHR

class SettingsView(APIView):
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH']:
            return [IsHR()]
        return [permissions.AllowAny()]

    def get(self, request):
        settings_obj = OrganizationSettings.get_settings()
        return Response(OrganizationSettingsSerializer(settings_obj).data)

    def patch(self, request):
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

class HolidayViewSet(viewsets.ModelViewSet):
    queryset = Holiday.objects.all().order_by('date')
    serializer_class = HolidaySerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsHR()]
        return [permissions.IsAuthenticated()]
