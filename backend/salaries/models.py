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
    daily_overrides = models.JSONField(default=dict, blank=True)

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
    snapshot_data = models.JSONField(default=dict, blank=True)

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


