from rest_framework import serializers
from attendance.models import Attendance, AttendanceCorrectionRequest, ShiftReport

class AttendanceSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_id_code = serializers.CharField(source='employee.employee_id', read_only=True)
    department_name = serializers.CharField(source='employee.department.name', read_only=True, default=None)
    taken_by_name = serializers.CharField(source='taken_by.email', read_only=True, default=None)

    class Meta:
        model = Attendance
        fields = [
            'id', 'employee', 'employee_name', 'employee_id_code', 'department_name',
            'date', 'check_in', 'check_out', 'working_hours', 'status', 'work_mode',
            'attendance_method', 'face_verified', 'liveness_verified', 'location_verified',
            'latitude', 'longitude', 'device_id', 'taken_by', 'taken_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

class FaceAttendanceScanSerializer(serializers.Serializer):
    employee_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    image_data = serializers.CharField(required=True)
    device_id = serializers.CharField(required=False, default='OPERATOR-CAM-01')

class FingerprintAttendanceScanSerializer(serializers.Serializer):
    biometric_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    fingerprint_hash = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    device_id = serializers.CharField(required=False, default='OPERATOR-FP-01')

class WFHAttendanceScanSerializer(serializers.Serializer):
    image_data = serializers.CharField(required=True)
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
            return {
                'id': att.id,
                'status': att.status,
                'work_mode': att.work_mode,
                'check_in': att.check_in.strftime('%H:%M:%S') if att.check_in else None,
                'check_out': att.check_out.strftime('%H:%M:%S') if att.check_out else None,
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
