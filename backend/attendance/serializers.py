from django.utils import timezone
from rest_framework import serializers
from attendance.models import Attendance, AttendanceCorrectionRequest, ShiftReport, FestivalHoliday

class AttendanceSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_id_code = serializers.CharField(source='employee.employee_id', read_only=True)
    department = serializers.CharField(source='employee.department.name', read_only=True, default=None)
    department_name = serializers.CharField(source='employee.department.name', read_only=True, default=None)
    shift = serializers.CharField(source='employee.shift', read_only=True, default='Morning')
    taken_by_name = serializers.CharField(source='taken_by.email', read_only=True, default=None)
    submitted_by_name = serializers.CharField(source='submitted_by.email', read_only=True, default=None)

    class Meta:
        model = Attendance
        fields = [
            'id', 'employee', 'employee_name', 'employee_id_code', 'department', 'department_name', 'shift',
            'date', 'check_in', 'check_out', 'working_hours', 'status', 'work_mode',
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

