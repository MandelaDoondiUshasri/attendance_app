from rest_framework import serializers
from salaries.models import Salary, SalaryHistory, SalaryChangeType

class SalarySerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_id_code = serializers.CharField(source='employee.employee_id', read_only=True)
    department_name = serializers.CharField(source='employee.department.name', read_only=True, default=None)

    class Meta:
        model = Salary
        fields = ['id', 'employee', 'employee_name', 'employee_id_code', 'department_name', 'current_salary', 'effective_date', 'updated_at']

class SalaryHistorySerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_id_code = serializers.CharField(source='employee.employee_id', read_only=True)
    changed_by_email = serializers.CharField(source='changed_by.email', read_only=True, default=None)

    class Meta:
        model = SalaryHistory
        fields = [
            'id', 'employee', 'employee_name', 'employee_id_code', 'previous_salary',
            'change_type', 'amount', 'percentage', 'new_salary', 'reason',
            'effective_date', 'changed_by', 'changed_by_email', 'created_at'
        ]

class SalaryChangeRequestSerializer(serializers.Serializer):
    employee_id = serializers.IntegerField(required=True)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=True)
    reason = serializers.CharField(required=True)
    effective_date = serializers.DateField(required=True)
    confirmed = serializers.BooleanField(required=True, help_text="Confirmation required before applying salary change")
