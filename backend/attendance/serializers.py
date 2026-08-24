from rest_framework import serializers
from attendance.models import Attendance, AttendanceCorrectionRequest, Task

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
        read_only_fields = ['id', 'original_check_in', 'original_check_out', 'status', 'reviewed_by', 'created_at']

class TaskSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'employee', 'employee_name', 'date', 'title',
            'description', 'status', 'hours_spent', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'employee', 'created_at', 'updated_at']
