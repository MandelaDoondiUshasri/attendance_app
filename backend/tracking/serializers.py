from rest_framework import serializers
from tracking.models import EmployeeScreenTime
from employees.models import Employee

class ScreenTimeHeartbeatSerializer(serializers.Serializer):
    active_seconds = serializers.IntegerField(min_value=1, max_value=120)

class EmployeeScreenTimeSummarySerializer(serializers.Serializer):
    employee_id = serializers.IntegerField()
    employee_code = serializers.CharField()
    full_name = serializers.CharField()
    email = serializers.EmailField()
    department = serializers.CharField(allow_null=True)
    designation = serializers.CharField(allow_null=True)
    avatar = serializers.CharField(allow_null=True)
    today_screen_time = serializers.CharField()
    weekly_screen_time = serializers.CharField()
    today_seconds = serializers.IntegerField()
    weekly_seconds = serializers.IntegerField()
    is_online = serializers.BooleanField()
    last_heartbeat = serializers.DateTimeField(allow_null=True)
