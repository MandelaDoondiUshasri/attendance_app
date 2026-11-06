from django.core.serializers.json import DjangoJSONEncoder
from django.db import models
from django.conf import settings
from employees.models import Employee

class SalaryChangeType(models.TextChoices):
    INCREMENT = 'INCREMENT', 'Salary Increment'
    DECREMENT = 'DECREMENT', 'Salary Decrement'
    INITIAL = 'INITIAL', 'Initial Salary Setting'

class Salary(models.Model):
    employee = models.OneToOneField(Employee, on_delete=models.CASCADE, related_name='salary_record')
    current_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    effective_date = models.DateField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.employee.full_name}: ₹{self.current_salary}"

class SalaryHistory(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='salary_histories')
    previous_salary = models.DecimalField(max_digits=12, decimal_places=2)
    change_type = models.CharField(max_length=20, choices=SalaryChangeType.choices, default=SalaryChangeType.INCREMENT)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    new_salary = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.TextField()
    effective_date = models.DateField()
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='salary_modifications')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.employee.full_name} [{self.get_change_type_display()}]: ₹{self.previous_salary} -> ₹{self.new_salary}"


class MonthlyPayslipAdjustment(models.Model):
    """
    Persists manual overrides / corrections made by CEO or HR to an employee's
    monthly payslip and attendance summary.
    """
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='payslip_adjustments')
    year = models.PositiveIntegerField()
    month = models.PositiveSmallIntegerField()

    # Overridden Summary Attendance & Leave Values (None indicates fallback to system computed)
    present_days = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    optional_leave_used = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    casual_leave_used = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    other_paid_leave_used = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    total_paid_leave_used = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    unpaid_absence_days = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    # Overridden Work Hours & Screen Time
    expected_working_hours = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    actual_working_hours = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    expected_screen_time = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    actual_screen_time = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)

    # Overridden Salary Computation
    monthly_salary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    effective_payable_days = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    per_day_salary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    salary_deduction = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    salary_payable = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    # Granular day-by-day corrections: dict of { "YYYY-MM-DD": { "working_hours": 8.0, "day_type": "...", ... } }
    daily_overrides = models.JSONField(default=dict, blank=True, encoder=DjangoJSONEncoder)

    # Reason & Audit Metadata
    reason = models.TextField(blank=True, default='')
    adjusted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='adjusted_payslips')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('employee', 'year', 'month')
        ordering = ['-year', '-month']

    def __str__(self):
        return f"Payslip Adjustment: {self.employee.full_name} ({self.month}/{self.year})"


class PayslipStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    GENERATED = 'GENERATED', 'Generated'
    VERIFIED = 'VERIFIED', 'Verified'
    RELEASED = 'RELEASED', 'Released'
    REVOKED = 'REVOKED', 'Revoked'


class Payslip(models.Model):
    """
    Official monthly payslip entity generated from finalized payroll calculations,
    reviewed and released by HR/CEO, and accessed securely by employees.
    """
    payslip_reference = models.CharField(max_length=64, unique=True, db_index=True)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='payslips')
    year = models.PositiveIntegerField(db_index=True)
    month = models.PositiveSmallIntegerField(db_index=True)
    version = models.PositiveIntegerField(default=1)
    status = models.CharField(
        max_length=20,
        choices=PayslipStatus.choices,
        default=PayslipStatus.GENERATED,
        db_index=True
    )

    # Financial breakdown
    monthly_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    per_day_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    gross_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    net_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    # Attendance & Leave Summary metrics
    total_calendar_days = models.PositiveSmallIntegerField(default=30)
    company_working_days = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    present_days = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    paid_leave_days = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    casual_leave_days = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    optional_leave_days = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    lop_days = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    lop_deduction = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    # Complete snapshot JSON (stores complete payroll calculation report data)
    snapshot_data = models.JSONField(default=dict, blank=True, encoder=DjangoJSONEncoder)

    # Generated PDF file storage
    pdf_file = models.FileField(upload_to='payslips/%Y/%m/', blank=True, null=True)

    # Audit & Workflow Metadata
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='generated_payslips'
    )
    generated_at = models.DateTimeField(auto_now_add=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_payslips'
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    released_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='released_payslips'
    )
    released_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='revoked_payslips'
    )
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoke_reason = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-year', '-month', '-created_at']
        unique_together = ('employee', 'year', 'month', 'version')

    def __str__(self):
        return f"{self.payslip_reference} - {self.employee.full_name} ({self.month}/{self.year}) [{self.status}]"




# ═════════════════════════════════════════════════════════════════════════════
# 2026 STATUTORY EPF / PF MODELS & STRUCTURES (GAZETTE S.O. 5109(E))
# ═════════════════════════════════════════════════════════════════════════════
from datetime import date
from decimal import Decimal


class EstablishmentCategory(models.TextChoices):
    STANDARD = 'STANDARD', 'Standard Establishment (12% Rate)'
    QUALIFYING_10_PERCENT = 'QUALIFYING_10_PERCENT', 'Qualifying Establishment (10% Statutory Rate)'


class PFConfiguration(models.Model):
    """
    Statutory EPF/EPS/EDLI configuration parameters.
    Supports date-effective ceiling transitions (e.g. ₹15,000 -> ₹25,000 w.e.f. 17 Sept 2026).
    """
    company = models.ForeignKey('tenants.Company', on_delete=models.CASCADE, null=True, blank=True, related_name='pf_configurations', db_index=True)
    wage_ceiling = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('25000.00'))
    previous_wage_ceiling = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('15000.00'))
    effective_date = models.DateField(default=date(2026, 9, 17))
    gazette_notification = models.CharField(max_length=100, default='S.O. 5109(E)')

    employee_contribution_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('12.00'))
    employer_contribution_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('12.00'))
    employer_eps_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('8.33'))
    employer_epf_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('3.67'))
    employer_edli_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.50'))
    admin_charge_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.50'))
    min_admin_charge_active = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('500.00'))
    min_admin_charge_inactive = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('75.00'))

    eps_wage_ceiling = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('25000.00'))
    previous_eps_wage_ceiling = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('15000.00'))
    edli_wage_ceiling = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('25000.00'))
    previous_edli_wage_ceiling = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('15000.00'))

    establishment_category = models.CharField(
        max_length=50,
        choices=EstablishmentCategory.choices,
        default=EstablishmentCategory.STANDARD
    )
    allow_higher_wage_contribution = models.BooleanField(default=True)
    rounding_rule = models.CharField(max_length=50, default='NEAREST_RUPEE')
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-effective_date', '-created_at']

    def __str__(self):
        return f"PF Config (Ceiling: ₹{self.wage_ceiling}, w.e.f {self.effective_date}) [{self.establishment_category}]"

    @classmethod
    def get_active_config(cls, target_date=None):
        if target_date is None:
            target_date = date.today()
        cfg = cls.objects.filter(is_active=True, effective_date__lte=target_date).order_by('-effective_date').first()
        if not cfg:
            cfg = cls.objects.filter(is_active=True).order_by('effective_date').first()
        if not cfg:
            cfg = cls.objects.create()
        return cfg


class PFConfigurationAuditLog(models.Model):
    """
    Immutable audit trail for modifications to statutory PF settings.
    """
    config = models.ForeignKey(PFConfiguration, on_delete=models.CASCADE, related_name='audit_logs')
    field_name = models.CharField(max_length=100)
    previous_value = models.TextField(blank=True, default='')
    new_value = models.TextField(blank=True, default='')
    modified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    reason = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"PF Config Change: {self.field_name} by {self.modified_by} at {self.created_at}"


class PayrollComponent(models.Model):
    """
    Salary component mapping to statutory treatment under EPFO rules.
    Basic, DA, and Retaining allowances are mandatory PF wages.
    Special Allowance is included unless explicitly excluded. HRA is strictly excluded.
    """
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50, unique=True)
    component_type = models.CharField(max_length=20, choices=[('EARNING', 'Earning'), ('DEDUCTION', 'Deduction')], default='EARNING')
    is_pf_wage_component = models.BooleanField(default=False, help_text="Included in EPF/EPS/EDLI wage calculation")
    is_statutory_deduction = models.BooleanField(default=False)
    default_percentage_of_gross = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveSmallIntegerField(default=1)

    class Meta:
        ordering = ['display_order', 'name']

    def __str__(self):
        return f"{self.name} ({self.code}) [PF Wage: {self.is_pf_wage_component}]"


class EmployeePFProfile(models.Model):
    """
    Dedicated employee statutory PF & Pension Profile.
    Preserves UAN, previous PF membership, exclusion reasons, and EPS eligibility.
    """
    employee = models.OneToOneField(Employee, on_delete=models.CASCADE, related_name='pf_profile')
    pf_applicable = models.BooleanField(default=True, db_index=True)
    epf_member = models.BooleanField(default=True)
    eps_member = models.BooleanField(default=True)

    uan_number = models.CharField(max_length=12, blank=True, null=True, db_index=True)
    pf_account_number = models.CharField(max_length=50, blank=True, null=True)
    pf_joining_date = models.DateField(null=True, blank=True)

    previous_pf_membership = models.BooleanField(default=False)
    previous_employer_pf_details = models.TextField(blank=True, default='')

    international_worker = models.BooleanField(default=False, help_text="No wage ceiling applies for international workers")
    eps_eligibility = models.BooleanField(default=True, help_text="Eligible for pension scheme")

    higher_wage_contribution = models.BooleanField(default=False, help_text="Opted to contribute on actual wage above statutory ceiling")
    pf_contribution_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('12.00'))
    establishment_category = models.CharField(max_length=50, default='STANDARD')

    pf_exclusion_status = models.BooleanField(default=False)
    exclusion_reason = models.CharField(max_length=255, blank=True, default='')

    # Salary structure breakdown percentages (defaults to HR Reference: 50% Basic, 25% HRA, 25% Special Allowance)
    basic_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('50.00'))
    da_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    hra_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('50.00'))
    special_allowance_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('25.00'))

    # Independent Statutory Controls
    employee_pf_enabled = models.BooleanField(default=True, help_text="Employee PF 12% deduction switch")
    employer_pf_enabled = models.BooleanField(default=True, help_text="Employer PF contribution switch")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['employee__employee_id']

    def __str__(self):
        status = "Active Member" if self.pf_applicable else ("Excluded" if self.pf_exclusion_status else "Not Applicable")
        return f"PF Profile: {self.employee.full_name} ({self.employee.employee_id}) [{status}]"

    def is_eps_eligible_by_age(self, as_of_date=None):
        """
        EPS eligibility ceases once the employee reaches 58 years of age.
        """
        if as_of_date is None:
            as_of_date = date.today()
        dob = self.employee.dob
        if not dob:
            return self.eps_eligibility
        
        # Calculate age on as_of_date
        age = as_of_date.year - dob.year - ((as_of_date.month, as_of_date.day) < (dob.month, dob.day))
        return self.eps_eligibility and (age < 58)


class PFContribution(models.Model):
    """
    Monthly PF, EPS, EDLI and Administrative charge contribution ledger.
    Stores complete statutory breakdown per employee per month.
    """
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='pf_contributions')
    year = models.PositiveIntegerField(db_index=True)
    month = models.PositiveSmallIntegerField(db_index=True)

    gross_wages = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    earned_gross_wages = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    pf_gross_wages = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00')) # Basic + DA + etc. before capping

    epf_wages = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00')) # Capped or actual
    eps_wages = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    edli_wages = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    employee_epf = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    employer_epf = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    employer_eps = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    employer_edli = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    admin_charges = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    ncp_days = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00')) # Non-contributory period

    # September 2026 Split Transition Specific Breakdown
    is_transition_month = models.BooleanField(default=False)
    period_1_epf_wages = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    period_1_eps_wages = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    period_1_employee_epf = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    period_1_employer_epf = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    period_1_employer_eps = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    period_2_epf_wages = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    period_2_eps_wages = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    period_2_employee_epf = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    period_2_employer_epf = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    period_2_employer_eps = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    metadata = models.JSONField(default=dict, blank=True, encoder=DjangoJSONEncoder)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('employee', 'year', 'month')
        ordering = ['-year', '-month', 'employee__employee_id']

    def __str__(self):
        return f"PF Contribution: {self.employee.full_name} ({self.month}/{self.year}) EE: ₹{self.employee_epf}, ER: ₹{self.employer_epf + self.employer_eps}"


class SalaryCalculationMode(models.TextChoices):
    CTC_BASED = 'CTC_BASED', 'CTC-based (Gross = CTC / 1.06)'
    GROSS_BASED = 'GROSS_BASED', 'Gross-based'
    COMPONENT_WISE = 'COMPONENT_WISE', 'Component-wise Manually Defined'


class TaxRegime(models.TextChoices):
    NEW_REGIME = 'NEW_REGIME', 'New Tax Regime (Section 115BAC)'
    OLD_REGIME = 'OLD_REGIME', 'Old Tax Regime (with Exemptions)'


class PayrollStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    PROCESSING = 'PROCESSING', 'Processing'
    UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
    APPROVED = 'APPROVED', 'Approved'
    FINALIZED = 'FINALIZED', 'Finalized'
    REVERSED = 'REVERSED', 'Reversed / Adjusted'
    PAID = 'PAID', 'Paid'


class Payroll(models.Model):
    """
    Comprehensive Monthly Payroll Record for an employee.
    Strictly keeps employer statutory contributions separate from employee deductions.
    """
    company = models.ForeignKey('tenants.Company', on_delete=models.CASCADE, null=True, blank=True, related_name='payrolls', db_index=True)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='payroll_records')
    year = models.PositiveIntegerField(db_index=True)
    month = models.PositiveSmallIntegerField(db_index=True)

    calendar_days = models.PositiveSmallIntegerField(default=30)
    payable_days = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    lop_days = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))

    monthly_ctc = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    annual_ctc = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    monthly_base_salary = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    gross_earned_salary = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    annual_gross = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    calculation_mode = models.CharField(max_length=30, default='CTC_BASED')
    tax_regime = models.CharField(max_length=20, default='NEW_REGIME')

    # Statutory Component Earnings
    basic_earned = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    da_earned = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    hra_earned = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    special_allowance_earned = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    # PF Statutory Figures
    eligible_pf_wages = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    employee_pf = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00')) # DEDUCTED from employee

    # Employer Contributions (NEVER deducted from employee take-home)
    employer_pf_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), help_text="Total 12% Employer PF")
    employer_epf = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    employer_eps = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    employer_edli = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    admin_charges = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    # Statutory deduction toggle states at time of payroll calculation
    employee_pf_enabled = models.BooleanField(default=True)
    employer_pf_enabled = models.BooleanField(default=True)
    pt_enabled = models.BooleanField(default=True)
    employee_esi_enabled = models.BooleanField(default=True)
    employer_esi_enabled = models.BooleanField(default=True)
    tds_enabled = models.BooleanField(default=True)

    # Other Employee Deductions
    professional_tax = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    tds = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    esi_employee = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    esi_employer = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    lop_deduction = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    other_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    total_employee_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    net_salary = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    total_employer_contributions = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_employer_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00')) # Gross Earned + ER Contributions

    status = models.CharField(
        max_length=20,
        choices=PayrollStatus.choices,
        default=PayrollStatus.DRAFT,
        db_index=True
    )
    is_locked = models.BooleanField(default=False)

    payslip = models.ForeignKey(
        Payslip,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='linked_payroll'
    )
    details = models.JSONField(default=dict, blank=True, encoder=DjangoJSONEncoder)

    finalized_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    finalized_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('employee', 'year', 'month')
        ordering = ['-year', '-month', 'employee__employee_id']

    def __str__(self):
        return f"Payroll: {self.employee.full_name} ({self.month}/{self.year}) [Net: ₹{self.net_salary}, Status: {self.status}]"


class PayrollAdjustment(models.Model):
    """
    Line-item adjustments (e.g. Arrears, Statutory Rectifications, Bonuses, Special Deductions)
    applied to a monthly payroll record.
    """
    payroll = models.ForeignKey(Payroll, on_delete=models.CASCADE, related_name='adjustments')
    adjustment_type = models.CharField(max_length=50) # e.g. 'BONUS', 'ARREARS', 'RECTIFICATION', 'DEDUCTION'
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    is_taxable = models.BooleanField(default=True)
    is_pf_applicable = models.BooleanField(default=False)
    reason = models.TextField()
    adjusted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.adjustment_type} (₹{self.amount}) for {self.payroll}"


class PayrollAuditLog(models.Model):
    """
    Audit log for payroll lifecycle events (Generation, Recalculation, Finalization, Overrides).
    """
    payroll = models.ForeignKey(Payroll, on_delete=models.CASCADE, null=True, blank=True, related_name='audit_logs')
    action = models.CharField(max_length=50)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    details = models.JSONField(default=dict, encoder=DjangoJSONEncoder)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Payroll Audit [{self.action}] by {self.actor} at {self.created_at}"


class SalaryStructure(models.Model):
    """
    Configurable Master Salary Structure Template.
    Supports CTC-based (e.g. 50-25-25 Gross = CTC / 1.06), Gross-based, and Component-wise definitions.
    """
    company = models.ForeignKey('tenants.Company', on_delete=models.CASCADE, null=True, blank=True, related_name='salary_structures', db_index=True)
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=50, unique=True, db_index=True)
    description = models.TextField(blank=True, default='')
    calculation_mode = models.CharField(
        max_length=30,
        choices=SalaryCalculationMode.choices,
        default=SalaryCalculationMode.CTC_BASED
    )

    # Percentage of Gross distributions (Default follows standard HR 50% Basic, 25% HRA, 25% Special Allowance)
    basic_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('50.00'))
    hra_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('50.00')) # 50% of Basic = 25% of Gross
    special_allowance_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('25.00'))
    da_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))

    # Allowance defaults
    conveyance_allowance = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    medical_allowance = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    other_allowances = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))

    # Statutory switches & Independent Toggles
    pf_applicable = models.BooleanField(default=True)
    employee_pf_enabled = models.BooleanField(default=True, help_text="Employee PF 12% deduction toggle")
    employer_pf_enabled = models.BooleanField(default=True, help_text="Employer PF 12% contribution toggle")
    pt_enabled = models.BooleanField(default=True, help_text="Professional Tax deduction toggle")
    employee_esi_enabled = models.BooleanField(default=True, help_text="Employee ESI deduction toggle")
    employer_esi_enabled = models.BooleanField(default=True, help_text="Employer ESI contribution toggle")
    tds_enabled = models.BooleanField(default=True, help_text="Income Tax / TDS deduction toggle")
    pf_basis_rule = models.CharField(
        max_length=50,
        default='HR_BASIC',
        choices=[
            ('HR_BASIC', 'HR Reference (12% of Basic Salary)'),
            ('STATUTORY_50_RULE', 'Statutory 2026 (Code on Social Security 50% Rule)'),
            ('BASIC_PLUS_DA', 'Basic + Dearness Allowance'),
            ('GROSS_CAPPED', 'All Wages Capped at ₹25,000 Ceiling')
        ]
    )
    esi_applicable = models.BooleanField(default=True)
    pt_applicable = models.BooleanField(default=True)
    default_pt_state = models.CharField(max_length=50, default='TELANGANA')

    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.code}) [{self.calculation_mode}]"


class EmployeeSalary(models.Model):
    """
    Assigned salary structure, CTC, component breakdown and tax parameters for an employee.
    """
    employee = models.OneToOneField(Employee, on_delete=models.CASCADE, related_name='salary_structure_profile')
    structure = models.ForeignKey(SalaryStructure, on_delete=models.SET_NULL, null=True, blank=True, related_name='employee_salaries')
    calculation_mode = models.CharField(
        max_length=30,
        choices=SalaryCalculationMode.choices,
        default=SalaryCalculationMode.CTC_BASED
    )

    # Core amounts
    monthly_ctc = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    annual_ctc = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    monthly_gross = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    annual_gross = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    # Earnings breakdown
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    hra = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    special_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    da = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    conveyance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    other_allowances = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    # Statutory configuration & 6 Independent Toggles
    pf_applicable = models.BooleanField(default=True)
    employee_pf_enabled = models.BooleanField(default=True, help_text="Employee PF 12% deduction toggle")
    employer_pf_enabled = models.BooleanField(default=True, help_text="Employer PF 12% contribution toggle")
    pt_enabled = models.BooleanField(default=True, help_text="Professional Tax deduction toggle")
    employee_esi_enabled = models.BooleanField(default=True, help_text="Employee ESI deduction toggle")
    employer_esi_enabled = models.BooleanField(default=True, help_text="Employer ESI contribution toggle")
    tds_enabled = models.BooleanField(default=True, help_text="Income Tax / TDS deduction toggle")
    esi_applicable = models.BooleanField(default=True)
    pt_state = models.CharField(max_length=50, default='TELANGANA')
    tax_regime = models.CharField(max_length=20, choices=TaxRegime.choices, default=TaxRegime.NEW_REGIME)
    monthly_tds = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))

    # Banking & Tax Identifiers
    bank_name = models.CharField(max_length=150, blank=True, default='')
    bank_account_number = models.CharField(max_length=50, blank=True, default='')
    bank_ifsc = models.CharField(max_length=20, blank=True, default='')
    pan_number = models.CharField(max_length=10, blank=True, default='')

    effective_date = models.DateField(default=date.today)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['employee__employee_id']

    def __str__(self):
        return f"{self.employee.full_name}: CTC ₹{self.monthly_ctc}/mo (Gross ₹{self.monthly_gross})"


class SalaryRevision(models.Model):
    """
    Immutable historical audit trail of all employee salary revisions, increments, and adjustments.
    """
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='salary_revisions')
    previous_monthly_ctc = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    revised_monthly_ctc = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    previous_gross = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    revised_gross = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    previous_net = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    revised_net = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    change_type = models.CharField(max_length=30, choices=SalaryChangeType.choices, default=SalaryChangeType.INCREMENT)
    effective_date = models.DateField(default=date.today)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_salary_revisions'
    )
    reason = models.TextField()
    breakdown_snapshot = models.JSONField(default=dict, blank=True, encoder=DjangoJSONEncoder)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Revision {self.employee.full_name}: ₹{self.previous_monthly_ctc} -> ₹{self.revised_monthly_ctc} [{self.change_type}]"


class EmployeeESIProfile(models.Model):
    """
    Employee State Insurance (ESIC) registration details and parameters.
    """
    employee = models.OneToOneField(Employee, on_delete=models.CASCADE, related_name='esi_profile')
    esi_applicable = models.BooleanField(default=True)
    esi_ip_number = models.CharField(max_length=17, blank=True, null=True, help_text="17-digit ESIC Insurance Person Number")
    dispensary_name = models.CharField(max_length=150, blank=True, default='')
    is_exempt = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        status = "Active" if self.esi_applicable else "Exempt"
        return f"ESI Profile: {self.employee.full_name} (IP: {self.esi_ip_number or 'Unregistered'}) [{status}]"
