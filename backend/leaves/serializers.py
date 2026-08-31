from rest_framework import serializers
from leaves.models import LeaveType, LeaveBalance, LeaveRequest
from attendance.validators import check_leave_wfh_overlap

class LeaveTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveType
        fields = ['id', 'name', 'code', 'days_allowed']

class LeaveBalanceSerializer(serializers.ModelSerializer):
    leave_type_name = serializers.CharField(source='leave_type.name', read_only=True)

    class Meta:
        model = LeaveBalance
        fields = ['id', 'employee', 'leave_type', 'leave_type_name', 'remaining_days']

class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_id_code = serializers.CharField(source='employee.employee_id', read_only=True)
    department_name = serializers.CharField(source='employee.department.name', read_only=True, default=None)
    leave_type_name = serializers.CharField(source='leave_type.name', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.email', read_only=True, default=None)

    class Meta:
        model = LeaveRequest
        fields = [
            'id', 'employee', 'employee_name', 'employee_id_code', 'department_name',
            'leave_type', 'leave_type_name', 'start_date', 'end_date', 'number_of_days',
            'is_half_day', 'half_day_period', 'work_mode',
            'reason', 'attachment', 'status', 'reviewed_by', 'reviewed_by_name',
            'approved_date', 'rejection_reason', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'employee', 'reviewed_by', 'approved_date', 'created_at', 'updated_at', 'number_of_days']

    def validate(self, data):
        start_date = data.get('start_date')
        end_date = data.get('end_date') or start_date
        is_half_day = data.get('is_half_day', False)

        if not start_date:
            raise serializers.ValidationError({"start_date": "Start date is required."})

        if end_date and start_date and end_date < start_date:
            raise serializers.ValidationError({"end_date": "End date cannot be before start date."})

        if is_half_day:
            end_date = start_date
            data['end_date'] = end_date
            data['number_of_days'] = 0.5
        else:
            if not end_date:
                end_date = start_date
                data['end_date'] = end_date
            diff = (end_date - start_date).days + 1
            data['number_of_days'] = float(diff)

        # Overlap check
        user = self.context['request'].user
        employee = user.employee_profile

        exclude_id = self.instance.pk if self.instance else None
        error_msg = check_leave_wfh_overlap(
            employee=employee,
            start_date=start_date,
            end_date=end_date,
            is_half_day=is_half_day,
            half_day_period=data.get('half_day_period'),
            exclude_leave_id=exclude_id
        )

        if error_msg:
            raise serializers.ValidationError({"error": error_msg})

        return data
