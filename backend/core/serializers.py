from rest_framework import serializers
from core.models import OrganizationSettings, Holiday

class OrganizationSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrganizationSettings
        fields = ['id', 'company_name', 'office_start_time', 'office_end_time', 'grace_period_minutes', 'required_working_hours', 'half_day_threshold_hours', 'updated_at']

class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = ['id', 'title', 'date', 'description', 'is_optional']
