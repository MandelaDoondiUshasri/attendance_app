from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from core.models import OrganizationSettings, Holiday
from core.serializers import OrganizationSettingsSerializer, HolidaySerializer
from accounts.permissions import IsCEO, IsHR

class SettingsView(APIView):
    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH']:
            return [IsCEO()]
        return [permissions.IsAuthenticated()]

    def get(self, request):
        settings_obj = OrganizationSettings.get_settings()
        return Response(OrganizationSettingsSerializer(settings_obj).data)

    def patch(self, request):
        settings_obj = OrganizationSettings.get_settings()
        serializer = OrganizationSettingsSerializer(settings_obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class HolidayViewSet(viewsets.ModelViewSet):
    queryset = Holiday.objects.all().order_by('date')
    serializer_class = HolidaySerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsHR()]
        return [permissions.IsAuthenticated()]
