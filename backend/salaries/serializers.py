from rest_framework import serializers
from salaries.models import Salary, SalaryHistory, SalaryChangeType, Payslip, PayslipStatus

class SalarySerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_id_code = serializers.CharField(source='employee.employee_id', read_only=True)
    department_name = serializers.CharField(source='employee.department.name', read_only=True, default=None)

    class Meta:
        model = Salary
        fields = ['id', 'employee', 'employee_name', 'employee_id_code', 'department_name', 'current_salary', 'effective_date', 'updated_at']

class SalaryHistorySerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_id_code = serializers.CharField(source='employee.employee_id', read_only=True)
    changed_by_email = serializers.CharField(source='changed_by.email', read_only=True, default=None)

    class Meta:
        model = SalaryHistory
        fields = [
            'id', 'employee', 'employee_name', 'employee_id_code', 'previous_salary',
            'change_type', 'amount', 'percentage', 'new_salary', 'reason',
            'effective_date', 'changed_by', 'changed_by_email', 'created_at'
        ]

class SalaryChangeRequestSerializer(serializers.Serializer):
    employee_id = serializers.IntegerField(required=True)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=True)
    reason = serializers.CharField(required=True)
    effective_date = serializers.DateField(required=True)
    confirmed = serializers.BooleanField(required=True, help_text="Confirmation required before applying salary change")


class PayslipSerializer(serializers.ModelSerializer):
    employee_id_code = serializers.CharField(source='employee.employee_id', read_only=True)
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    department_name = serializers.CharField(source='employee.department.name', read_only=True, default='Unassigned')
    designation_title = serializers.CharField(source='employee.designation.title', read_only=True, default='Unassigned')
    generated_by_name = serializers.SerializerMethodField()
    verified_by_name = serializers.SerializerMethodField()
    released_by_name = serializers.SerializerMethodField()
    pdf_url = serializers.SerializerMethodField()

    class Meta:
        model = Payslip
        fields = [
            'id', 'payslip_reference', 'employee', 'employee_id_code', 'employee_name',
            'department_name', 'designation_title', 'year', 'month', 'version', 'status',
            'monthly_salary', 'per_day_salary', 'gross_salary', 'total_deductions', 'net_salary',
            'total_calendar_days', 'company_working_days', 'present_days', 'paid_leave_days',
            'casual_leave_days', 'optional_leave_days', 'lop_days', 'lop_deduction',
            'pdf_file', 'pdf_url', 'generated_by', 'generated_by_name', 'generated_at',
            'verified_by', 'verified_by_name', 'verified_at',
            'released_by', 'released_by_name', 'released_at',
            'revoked_by', 'revoked_at', 'revoke_reason',
            'created_at', 'updated_at'
        ]

    def get_generated_by_name(self, obj):
        return obj.generated_by.get_full_name() or obj.generated_by.email if obj.generated_by else None

    def get_verified_by_name(self, obj):
        return obj.verified_by.get_full_name() or obj.verified_by.email if obj.verified_by else None

    def get_released_by_name(self, obj):
        return obj.released_by.get_full_name() or obj.released_by.email if obj.released_by else None

    def get_pdf_url(self, obj):
        if obj.pdf_file:
            return obj.pdf_file.url
        return None


class PayslipDetailSerializer(PayslipSerializer):
    class Meta(PayslipSerializer.Meta):
        fields = PayslipSerializer.Meta.fields + ['snapshot_data']



# ═════════════════════════════════════════════════════════════════════════════
# 2026 STATUTORY EPF / PF SERIALIZERS
# ═════════════════════════════════════════════════════════════════════════════
from salaries.models import (
    PFConfiguration, PFConfigurationAuditLog, EmployeePFProfile,
    PFContribution, Payroll, PayrollComponent, PayrollAdjustment,
    SalaryStructure, EmployeeSalary, SalaryRevision, EmployeeESIProfile
)


class PFConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PFConfiguration
        fields = '__all__'


class PFConfigurationAuditLogSerializer(serializers.ModelSerializer):
    modified_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PFConfigurationAuditLog
        fields = ['id', 'field_name', 'previous_value', 'new_value', 'modified_by', 'modified_by_name', 'reason', 'created_at']

    def get_modified_by_name(self, obj):
        return obj.modified_by.get_full_name() or obj.modified_by.email if obj.modified_by else None


class EmployeePFProfileSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source='employee.employee_id', read_only=True)
    full_name = serializers.CharField(source='employee.full_name', read_only=True)
    department_name = serializers.CharField(source='employee.department.name', read_only=True, default='Unassigned')
    dob = serializers.DateField(source='employee.dob', read_only=True)

    class Meta:
        model = EmployeePFProfile
        fields = [
            'id', 'employee', 'employee_code', 'full_name', 'department_name', 'dob',
            'pf_applicable', 'epf_member', 'eps_member', 'uan_number', 'pf_account_number',
            'pf_joining_date', 'previous_pf_membership', 'previous_employer_pf_details',
            'international_worker', 'eps_eligibility', 'higher_wage_contribution',
            'pf_contribution_rate', 'establishment_category', 'pf_exclusion_status',
            'exclusion_reason', 'basic_percentage', 'da_percentage', 'hra_percentage',
            'special_allowance_percentage', 'employee_pf_enabled', 'employer_pf_enabled',
            'created_at', 'updated_at'
        ]

    def validate_uan_number(self, value):
        if value:
            clean_uan = value.strip()
            if not clean_uan.isdigit() or len(clean_uan) != 12:
                raise serializers.ValidationError("UAN must be a valid 12-digit numeric identification number.")
            return clean_uan
        return value


class PFContributionSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source='employee.employee_id', read_only=True)
    full_name = serializers.CharField(source='employee.full_name', read_only=True)
    department_name = serializers.CharField(source='employee.department.name', read_only=True, default='Unassigned')

    class Meta:
        model = PFContribution
        fields = '__all__'


class PayrollSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source='employee.employee_id', read_only=True)
    full_name = serializers.CharField(source='employee.full_name', read_only=True)
    department_name = serializers.CharField(source='employee.department.name', read_only=True, default='Unassigned')

    class Meta:
        model = Payroll
        fields = '__all__'


class PayrollComponentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollComponent
        fields = '__all__'


class SalaryStructureSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalaryStructure
        fields = '__all__'


class EmployeeSalarySerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source='employee.employee_id', read_only=True)
    full_name = serializers.CharField(source='employee.full_name', read_only=True)
    department_name = serializers.CharField(source='employee.department.name', read_only=True, default='Unassigned')
    designation_name = serializers.CharField(source='employee.designation.name', read_only=True, default='Unassigned')
    structure_name = serializers.CharField(source='structure.name', read_only=True, default='Custom Structure')

    class Meta:
        model = EmployeeSalary
        fields = '__all__'


class SalaryRevisionSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source='employee.employee_id', read_only=True)
    full_name = serializers.CharField(source='employee.full_name', read_only=True)
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = SalaryRevision
        fields = '__all__'

    def get_approved_by_name(self, obj):
        return obj.approved_by.get_full_name() or obj.approved_by.email if obj.approved_by else 'HR Admin'


class EmployeeESIProfileSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source='employee.employee_id', read_only=True)
    full_name = serializers.CharField(source='employee.full_name', read_only=True)

    class Meta:
        model = EmployeeESIProfile
        fields = '__all__'

    def validate_esi_ip_number(self, value):
        if value:
            clean_ip = value.strip()
            if not clean_ip.isdigit() or len(clean_ip) != 17:
                raise serializers.ValidationError("ESIC IP Number must be a valid 17-digit numeric identifier.")
            return clean_ip
        return value
