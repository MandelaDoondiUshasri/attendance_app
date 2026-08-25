from rest_framework import serializers
from employees.models import Employee, Department, Designation
from accounts.models import User, Role

class DepartmentSerializer(serializers.ModelSerializer):
    employee_count = serializers.IntegerField(source='employees.count', read_only=True)

    class Meta:
        model = Department
        fields = ['id', 'name', 'code', 'description', 'employee_count', 'created_at']

class DesignationSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta:
        model = Designation
        fields = ['id', 'title', 'department', 'department_name', 'description', 'created_at']

class EmployeeSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True, default=None)
    designation_title = serializers.CharField(source='designation.title', read_only=True, default=None)
    manager_name = serializers.CharField(source='manager.full_name', read_only=True, default=None)
    role = serializers.CharField(source='user.role', read_only=True)
    fingerprint_enrolled = serializers.SerializerMethodField()
    fingerprint_hash = serializers.SerializerMethodField()

    def get_fingerprint_enrolled(self, obj):
        return hasattr(obj, 'fingerprint_profile')

    def get_fingerprint_hash(self, obj):
        profile = getattr(obj, 'fingerprint_profile', None)
        return profile.template_hash if profile else None

    class Meta:
        model = Employee
        fields = [
            'id', 'employee_id', 'user', 'full_name', 'email', 'phone', 'profile_photo',
            'department', 'department_name', 'designation', 'designation_title',
            'joining_date', 'work_mode', 'manager', 'manager_name', 'employment_status',
            'face_profile_enrolled', 'fingerprint_enrolled', 'fingerprint_hash', 'biometric_id', 'salary', 'leave_balance', 'is_half_day', 'role',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']

class CreateEmployeeSerializer(serializers.Serializer):
    employee_id = serializers.CharField(max_length=30)
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(choices=Role.choices, default=Role.EMPLOYEE)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all(), required=False, allow_null=True)
    designation = serializers.PrimaryKeyRelatedField(queryset=Designation.objects.all(), required=False, allow_null=True)
    joining_date = serializers.DateField()
    work_mode = serializers.CharField(default='OFFICE')
    salary = serializers.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    leave_balance = serializers.IntegerField(default=24)
    is_half_day = serializers.BooleanField(default=False)
    biometric_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def create(self, validated_data):
        email = validated_data.pop('email')
        password = validated_data.pop('password')
        role = validated_data.pop('role')

        user = User.objects.create_user(
            email=email,
            password=password,
            role=role,
            first_name=validated_data['full_name'].split(' ')[0],
            last_name=' '.join(validated_data['full_name'].split(' ')[1:]) if ' ' in validated_data['full_name'] else ''
        )

        employee = Employee.objects.create(
            user=user,
            email=email,
            **validated_data
        )
        return employee
