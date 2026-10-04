from rest_framework import serializers
from leaves.models import LeaveType, LeaveBalance, LeaveRequest, AdditionalLeaveStatus
from leaves.services import CasualLeavePolicyEngine
from attendance.validators import check_leave_wfh_overlap

class LeaveTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveType
        fields = ['id', 'name', 'code', 'days_allowed', 'is_paid']

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
    is_paid = serializers.BooleanField(source='leave_type.is_paid', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.email', read_only=True, default=None)

    class Meta:
        model = LeaveRequest
        fields = [
            'id', 'employee', 'employee_name', 'employee_id_code', 'department_name',
            'leave_type', 'leave_type_name', 'is_paid', 'start_date', 'end_date', 'number_of_days',
            'is_half_day', 'half_day_period', 'work_mode',
            'cl_days', 'lop_days', 'additional_leave_days', 'additional_leave_status',
            'daily_salary_rate', 'expected_lop_deduction',
            'reason', 'attachment', 'status', 'reviewed_by', 'reviewed_by_name',
            'approved_date', 'rejection_reason', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'employee', 'reviewed_by', 'approved_date', 'created_at', 'updated_at',
            'number_of_days', 'cl_days', 'lop_days', 'additional_leave_days', 'additional_leave_status',
            'daily_salary_rate', 'expected_lop_deduction'
        ]

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
        user = self.context.get('request').user if self.context.get('request') else None
        employee = getattr(user, 'employee_profile', None) if user else None
        if not employee and self.instance:
            employee = self.instance.employee
        elif not employee and data.get('employee'):
            employee = data.get('employee')

        if not employee:
            raise serializers.ValidationError({"employee": "Employee profile could not be identified for this leave request."})

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

        # Casual Leave Allowance & Split Leave Evaluation (on creation)
        leave_type = data.get('leave_type')
        if leave_type and not self.instance:
            try:
                evaluation = CasualLeavePolicyEngine.evaluate_leave_request(
                    employee=employee,
                    leave_type=leave_type,
                    start_date=start_date,
                    requested_days=data['number_of_days']
                )
                data['cl_days'] = evaluation['cl_days']
                data['lop_days'] = evaluation['lop_days']
                data['additional_leave_days'] = evaluation['additional_leave_days']
                data['additional_leave_status'] = evaluation['additional_leave_status']
                data['daily_salary_rate'] = evaluation['daily_salary_rate']
                data['expected_lop_deduction'] = evaluation['expected_lop_deduction']
            except ValueError as ve:
                raise serializers.ValidationError({"leave_type": str(ve)})

        return data
