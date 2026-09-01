from rest_framework import serializers
from django.contrib.auth import authenticate
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from accounts.models import User, Role

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        avatar_url = None
        if self.user.avatar:
            try:
                avatar_url = self.user.avatar.url
            except Exception:
                avatar_url = None

        data['user'] = {
            'id': self.user.id,
            'email': self.user.email,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
            'role': Role.CEO if self.user.role == Role.SYSTEM_ADMIN else self.user.role,
            'avatar': avatar_url,
        }
        # Include employee ID if employee profile exists
        if hasattr(self.user, 'employee_profile'):
            data['user']['employee_id'] = self.user.employee_profile.employee_id
            data['user']['department'] = self.user.employee_profile.department.name if self.user.employee_profile.department else None
            data['user']['designation'] = self.user.employee_profile.designation.title if self.user.employee_profile.designation else None
            data['user']['work_mode'] = self.user.employee_profile.work_mode
            data['user']['mobile_access_enabled'] = getattr(self.user.employee_profile, 'mobile_access_enabled', False)
            data['user']['is_half_day'] = getattr(self.user.employee_profile, 'is_half_day', False)
        return data

class UserSerializer(serializers.ModelSerializer):
    employee_id = serializers.CharField(source='employee_profile.employee_id', read_only=True, default=None)
    department = serializers.CharField(source='employee_profile.department.name', read_only=True, default=None)
    designation = serializers.CharField(source='employee_profile.designation.title', read_only=True, default=None)
    work_mode = serializers.CharField(source='employee_profile.work_mode', read_only=True, default=None)
    mobile_access_enabled = serializers.BooleanField(source='employee_profile.mobile_access_enabled', read_only=True, default=False)
    is_half_day = serializers.BooleanField(source='employee_profile.is_half_day', read_only=True, default=False)
    avatar = serializers.ImageField(required=False, allow_null=True)
    role = serializers.SerializerMethodField()

    def get_role(self, obj):
        return Role.CEO if obj.role == Role.SYSTEM_ADMIN else obj.role

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.avatar:
            try:
                data['avatar'] = instance.avatar.url
            except Exception:
                data['avatar'] = None
        else:
            data['avatar'] = None
        return data

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'phone_number', 'avatar', 'role', 'is_active', 'employee_id', 'department', 'designation', 'work_mode', 'mobile_access_enabled', 'is_half_day']
        read_only_fields = ['id', 'email']

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)

class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)

class ResetPasswordConfirmSerializer(serializers.Serializer):
    uidb64 = serializers.CharField(required=True)
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)
