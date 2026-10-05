from django.utils import timezone
from rest_framework import serializers
from attendance.models import (
    Attendance, AttendanceCorrectionRequest, ShiftReport, FestivalHoliday,
    EarlyPassRequest, EarlyPassAuditLog
)

class AttendanceSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_id_code = serializers.CharField(source='employee.employee_id', read_only=True)
    department = serializers.CharField(source='employee.department.name', read_only=True, default=None)
    department_name = serializers.CharField(source='employee.department.name', read_only=True, default=None)
    shift = serializers.CharField(source='employee.shift', read_only=True, default='Morning')
    taken_by_name = serializers.CharField(source='taken_by.email', read_only=True, default=None)
    submitted_by_name = serializers.CharField(source='submitted_by.email', read_only=True, default=None)
    display_status = serializers.SerializerMethodField()
    early_pass_info = serializers.SerializerMethodField()

    def get_display_status(self, obj):
        return obj.get_display_status()

    def get_early_pass_info(self, obj):
        ep = obj.early_pass
        if not ep:
            return None
        return {
            'id': ep.id,
            'pass_reference': ep.pass_reference,
            'status': ep.status,
            'requested_exit_time': ep.requested_exit_time,
            'required_hours': float(ep.required_hours),
            'actual_working_hours': float(ep.actual_working_hours),
            'missing_hours': float(ep.missing_hours),
            'reason': ep.reason,
            'salary_deduction': 0.00 if ep.status == 'APPROVED' else None
        }

    class Meta:
        model = Attendance
        fields = [
            'id', 'employee', 'employee_name', 'employee_id_code', 'department', 'department_name', 'shift',
            'date', 'check_in', 'check_out', 'working_hours', 'status', 'work_mode',
            'display_status', 'early_pass_info',
            'attendance_method', 'location_verified',
            'latitude', 'longitude', 'device_id', 'taken_by', 'taken_by_name',
            'is_submitted', 'submitted_by', 'submitted_by_name', 'submitted_at',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None

        # EarlyPass display override
        ep = instance.early_pass
        if ep:
            if ep.status == 'APPROVED':
                ret['display_status'] = 'Present – Approved Early Exit'
                ret['salary_deduction'] = 0.00
            elif ep.status == 'PENDING' and instance.check_out:
                ret['display_status'] = 'Early Exit – Approval Pending'

        # Illusion for employees: show PRESENT and ABSENT only (mask HALF_DAY as PRESENT)
        if user and getattr(user, 'role', None) == 'EMPLOYEE':
            if ret.get('status') == 'HALF_DAY':
                ret['status'] = 'PRESENT'
        return ret

class WFHAttendanceScanSerializer(serializers.Serializer):
    latitude = serializers.FloatField(required=True)
    longitude = serializers.FloatField(required=True)
    device_id = serializers.CharField(required=False, default='MOBILE-WEB')

class AttendanceCorrectionSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_id_code = serializers.CharField(source='employee.employee_id', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.email', read_only=True, default=None)

    class Meta:
        model = AttendanceCorrectionRequest
        fields = [
            'id', 'employee', 'employee_name', 'employee_id_code', 'date', 'attendance',
            'original_check_in', 'original_check_out', 'requested_check_in', 'requested_check_out',
            'reason', 'attachment', 'status', 'reviewed_by', 'reviewed_by_name', 'rejection_reason',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'employee', 'attendance', 'original_check_in', 'original_check_out', 'status', 'reviewed_by', 'created_at', 'updated_at']

class ShiftReportSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_id_code = serializers.CharField(source='employee.employee_id', read_only=True)
    employee_email = serializers.CharField(source='employee.email', read_only=True)
    department_name = serializers.CharField(source='employee.department.name', read_only=True, default='Unassigned')
    attendance_info = serializers.SerializerMethodField()

    def get_attendance_info(self, obj):
        from attendance.models import Attendance
        att = Attendance.objects.filter(employee=obj.employee, date=obj.date).first()
        if att:
            request = self.context.get('request')
            user = getattr(request, 'user', None) if request else None
            status_val = att.status
            # Illusion for employees: show PRESENT and ABSENT only (mask HALF_DAY as PRESENT)
            if user and getattr(user, 'role', None) == 'EMPLOYEE' and status_val == 'HALF_DAY':
                status_val = 'PRESENT'
            return {
                'id': att.id,
                'status': status_val,
                'work_mode': att.work_mode,
                'check_in': timezone.localtime(att.check_in).strftime('%H:%M:%S') if att.check_in else None,
                'check_out': timezone.localtime(att.check_out).strftime('%H:%M:%S') if att.check_out else None,
                'total_hours_worked': float(att.working_hours) if att.working_hours else 0.0,
                'is_late': att.status == 'LATE'
            }
        return {
            'status': 'NOT_MARKED',
            'work_mode': obj.employee.work_mode,
            'check_in': None,
            'check_out': None,
            'total_hours_worked': 0.0,
            'is_late': False
        }

    class Meta:
        model = ShiftReport
        fields = [
            'id', 'employee', 'employee_name', 'employee_id_code', 'employee_email',
            'department_name', 'date', 'report_content', 'attendance_info',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'employee', 'created_at', 'updated_at']

class FestivalHolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = FestivalHoliday
        fields = '__all__'

class DailyAttendanceSubmissionSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    submitted_by_name = serializers.CharField(source='submitted_by.email', read_only=True, default=None)

    class Meta:
        from attendance.models import DailyAttendanceSubmission
        model = DailyAttendanceSubmission
        fields = [
            'id', 'department', 'department_name', 'date', 'submitted_by', 'submitted_by_name',
            'submitted_at', 'total_workers', 'present_count', 'absent_count', 'late_count',
            'leave_count', 'half_day_count', 'notes'
        ]
        read_only_fields = ['id', 'submitted_at']

class AttendanceBreakSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_id_code = serializers.CharField(source='employee.employee_id', read_only=True)
    initiated_by_name = serializers.CharField(source='initiated_by.email', read_only=True, default=None)
    current_duration_minutes = serializers.SerializerMethodField()

    def get_current_duration_minutes(self, obj):
        if obj.is_active:
            from django.utils import timezone
            diff = (timezone.now() - obj.start_time).total_seconds() / 60.0
            return max(0, int(round(diff)))
        return obj.duration_minutes

    class Meta:
        from attendance.models import AttendanceBreak
        model = AttendanceBreak
        fields = [
            'id', 'employee', 'employee_name', 'employee_id_code', 'attendance',
            'break_type', 'start_time', 'end_time', 'duration_minutes',
            'current_duration_minutes', 'is_active', 'initiated_by',
            'initiated_by_name', 'notes', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class EarlyPassAuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = EarlyPassAuditLog
        fields = [
            'id', 'action', 'actor_name', 'actor_role', 'previous_status',
            'new_status', 'remarks', 'timestamp'
        ]


class EarlyPassRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_id_code = serializers.CharField(source='employee.employee_id', read_only=True)
    employee_email = serializers.CharField(source='employee.email', read_only=True)
    department_name = serializers.CharField(source='employee.department.name', read_only=True, default='Unassigned')
    approved_by_name = serializers.SerializerMethodField()
    rejected_by_name = serializers.SerializerMethodField()
    audit_trails = EarlyPassAuditLogSerializer(many=True, read_only=True)
    salary_deduction_waived = serializers.SerializerMethodField()
    display_status = serializers.SerializerMethodField()

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.get_full_name() or obj.approved_by.email
        return None

    def get_rejected_by_name(self, obj):
        if obj.rejected_by:
            return obj.rejected_by.get_full_name() or obj.rejected_by.email
        return None

    def get_salary_deduction_waived(self, obj):
        return obj.status == 'APPROVED'

    def get_display_status(self, obj):
        if obj.status == 'APPROVED':
            return 'Present – Approved Early Exit'
        elif obj.status == 'PENDING':
            return 'Pending Approval'
        elif obj.status == 'REJECTED':
            return 'Rejected'
        elif obj.status == 'CANCELLED':
            return 'Cancelled'
        return obj.get_status_display()

    class Meta:
        model = EarlyPassRequest
        fields = [
            'id', 'pass_reference', 'employee', 'employee_name', 'employee_id_code', 'employee_email',
            'department_name', 'attendance', 'request_date', 'check_in_time',
            'requested_exit_time', 'actual_exit_time', 'required_hours', 'actual_working_hours',
            'missing_hours', 'reason', 'remarks', 'attachment', 'status', 'display_status',
            'approved_by', 'approved_by_name', 'approved_at',
            'rejected_by', 'rejected_by_name', 'rejected_at',
            'approval_remarks', 'audit_trails', 'salary_deduction_waived',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'pass_reference', 'employee', 'attendance',
            'actual_exit_time', 'required_hours', 'actual_working_hours', 'missing_hours',
            'status', 'approved_by', 'approved_at', 'rejected_by', 'rejected_at',
            'created_at', 'updated_at'
        ]

