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
    role = serializers.CharField(source='user.role', required=False)

    class Meta:
        model = Employee
        fields = [
            'id', 'employee_id', 'user', 'full_name', 'email', 'phone', 'dob', 'gender', 'emergency_contact', 'address', 'profile_photo',
            'department', 'department_name', 'designation', 'designation_title',
            'joining_date', 'work_mode', 'manager', 'manager_name', 'employment_status',
            'salary', 'leave_balance', 'is_half_day', 'mobile_access_enabled', 'role',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        role = user_data.get('role') if isinstance(user_data, dict) else None

        user = instance.user
        updated_user = False

        if 'email' in validated_data and validated_data['email'] != user.email:
            new_email = validated_data['email'].strip().lower()
            if User.objects.filter(email__iexact=new_email).exclude(id=user.id).exists():
                raise serializers.ValidationError({'email': 'This email is already in use by another account.'})
            user.email = new_email
            updated_user = True

        if 'full_name' in validated_data:
            name_parts = validated_data['full_name'].strip().split(' ')
            user.first_name = name_parts[0] if name_parts else ''
            user.last_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ''
            updated_user = True

        if role and role != user.role:
            user.role = role
            updated_user = True

        if updated_user:
            user.save()

        return super().update(instance, validated_data)

class CreateEmployeeSerializer(serializers.Serializer):
    employee_id = serializers.CharField(max_length=30)
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(choices=Role.choices, default=Role.EMPLOYEE)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True, allow_null=True)
    dob = serializers.DateField(required=False, allow_null=True)
    gender = serializers.CharField(max_length=20, required=False, allow_blank=True, allow_null=True)
    emergency_contact = serializers.CharField(max_length=50, required=False, allow_blank=True, allow_null=True)
    address = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all(), required=False, allow_null=True)
    designation = serializers.PrimaryKeyRelatedField(queryset=Designation.objects.all(), required=False, allow_null=True)
    joining_date = serializers.DateField(required=False, allow_null=True)
    work_mode = serializers.CharField(default='OFFICE')
    salary = serializers.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    leave_balance = serializers.FloatField(default=24.0)
    is_half_day = serializers.BooleanField(default=False)
    mobile_access_enabled = serializers.BooleanField(default=False)

    def validate_role(self, value):
        request = self.context.get('request')
        if request and request.user:
            user_role = request.user.role
            if user_role == Role.HR and value in [Role.CEO, Role.SYSTEM_ADMIN]:
                raise serializers.ValidationError("HR cannot create CEO or System Admin accounts.")
            if user_role == Role.CEO and value == Role.SYSTEM_ADMIN:
                raise serializers.ValidationError("Only System Admins can create other System Admins.")
        return value

    def validate_email(self, value):
        email_clean = value.strip().lower()
        if User.objects.filter(email__iexact=email_clean).exists():
            raise serializers.ValidationError("An account with this email address already exists.")
        if Employee.objects.filter(email__iexact=email_clean).exists():
            raise serializers.ValidationError("An employee with this email address already exists.")
        return email_clean

    def validate_employee_id(self, value):
        emp_id_clean = value.strip()
        if Employee.objects.filter(employee_id__iexact=emp_id_clean).exists():
            raise serializers.ValidationError(f"Employee ID '{emp_id_clean}' is already in use. Please use a unique Employee ID.")
        return emp_id_clean

    def create(self, validated_data):
        from django.db import transaction
        from django.utils import timezone

        email = validated_data.pop('email').strip().lower()
        password = validated_data.pop('password')
        role = validated_data.pop('role')
        full_name = validated_data.get('full_name', '').strip()

        if not validated_data.get('joining_date'):
            validated_data['joining_date'] = timezone.now().date()

        name_parts = full_name.split(' ')
        first_name = name_parts[0] if name_parts else ''
        last_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ''

        with transaction.atomic():
            user = User.objects.create_user(
                email=email,
                password=password,
                role=role,
                first_name=first_name,
                last_name=last_name
            )

            employee = Employee.objects.create(
                user=user,
                email=email,
                **validated_data
            )
            return employee
