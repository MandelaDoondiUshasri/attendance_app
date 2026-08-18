from rest_framework import serializers
from wfh.models import WFHRequest

class WFHRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_id_code = serializers.CharField(source='employee.employee_id', read_only=True)
    department_name = serializers.CharField(source='employee.department.name', read_only=True, default=None)
    reviewed_by_name = serializers.CharField(source='reviewed_by.email', read_only=True, default=None)

    class Meta:
        model = WFHRequest
        fields = [
            'id', 'employee', 'employee_name', 'employee_id_code', 'department_name',
            'date', 'reason', 'attachment', 'status', 'reviewed_by', 'reviewed_by_name',
            'rejection_reason', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'employee', 'status', 'reviewed_by', 'created_at', 'updated_at']
