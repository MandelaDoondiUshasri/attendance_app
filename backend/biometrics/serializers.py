from rest_framework import serializers
from biometrics.models import FaceProfile, FingerprintProfile, BiometricDevice

class FaceProfileSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_id_code = serializers.CharField(source='employee.employee_id', read_only=True)

    class Meta:
        model = FaceProfile
        fields = ['id', 'employee', 'employee_name', 'employee_id_code', 'liveness_enrolled', 'enrolled_at']

class BiometricDeviceSerializer(serializers.ModelSerializer):
    device_type_display = serializers.CharField(source='get_device_type_display', read_only=True)

    class Meta:
        model = BiometricDevice
        fields = ['id', 'device_id', 'name', 'device_type', 'device_type_display', 'ip_address', 'is_online', 'location_name', 'last_sync']

class EnrollFaceSerializer(serializers.Serializer):
    employee_id = serializers.CharField()
    image_data = serializers.CharField()

class EnrollFingerprintSerializer(serializers.Serializer):
    employee_id = serializers.CharField()
    fingerprint_data = serializers.CharField()

class FingerprintProfileSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_id_code = serializers.CharField(source='employee.employee_id', read_only=True)

    class Meta:
        model = FingerprintProfile
        fields = ['id', 'employee', 'employee_name', 'employee_id_code', 'enrolled_at']
