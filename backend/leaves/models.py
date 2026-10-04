from django.db import models
from django.conf import settings
from employees.models import Employee, WorkMode

class LeaveStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Approval'
    APPROVED = 'APPROVED', 'Approved'
    REJECTED = 'REJECTED', 'Rejected'
    CANCELLED = 'CANCELLED', 'Cancelled'

class LeaveType(models.Model):
    name = models.CharField(max_length=50, unique=True) # e.g. Paid Leave, Casual Leave, Sick Leave, Loss of Pay
    code = models.CharField(max_length=20, unique=True)
    days_allowed = models.IntegerField(default=12)
    is_paid = models.BooleanField(default=True, help_text="True if paid leave, False if Loss of Pay / Unpaid leave")

    def __str__(self):
        paid_label = "Paid" if self.is_paid else "Loss of Pay"
        return f"{self.name} ({self.code}) [{paid_label}]"

class LeaveBalance(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='leave_balances')
    leave_type = models.ForeignKey(LeaveType, on_delete=models.CASCADE)
    allocated_days = models.FloatField(null=True, blank=True)
    remaining_days = models.FloatField(default=12.0)

    class Meta:
        unique_together = ['employee', 'leave_type']

    def __str__(self):
        return f"{self.employee.full_name} - {self.leave_type.name}: {self.remaining_days} days"

class AdditionalLeaveStatus(models.TextChoices):
    NONE = 'NONE', 'Not Applicable'
    PENDING = 'PENDING', 'Pending Higher-Authority Approval'
    APPROVED = 'APPROVED', 'Approved as Loss of Pay'
    REJECTED = 'REJECTED', 'Rejected'

class LeaveRequest(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='leave_requests')
    leave_type = models.ForeignKey(LeaveType, on_delete=models.CASCADE)
    start_date = models.DateField(db_index=True)
    end_date = models.DateField(db_index=True)
    number_of_days = models.FloatField(default=1.0)
    is_half_day = models.BooleanField(default=False)
    half_day_period = models.CharField(max_length=20, null=True, blank=True)
    work_mode = models.CharField(max_length=20, choices=WorkMode.choices, default=WorkMode.OFFICE)
    reason = models.TextField()
    attachment = models.FileField(upload_to='leaves/', blank=True, null=True)
    status = models.CharField(max_length=20, choices=LeaveStatus.choices, default=LeaveStatus.PENDING, db_index=True)

    # Dynamic CL / LOP Split & Higher Authority Approval tracking
    cl_days = models.FloatField(default=0.0, help_text="Days covered under Casual Leave allowance")
    lop_days = models.FloatField(default=0.0, help_text="Days approved as Loss of Pay")
    additional_leave_days = models.FloatField(default=0.0, help_text="Additional requested days beyond normal CL allowance")
    additional_leave_status = models.CharField(
        max_length=20,
        choices=AdditionalLeaveStatus.choices,
        default=AdditionalLeaveStatus.NONE,
        db_index=True
    )
    daily_salary_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Daily salary based on actual calendar days")
    expected_lop_deduction = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Expected or applied salary deduction for LOP days")

    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_leaves')
    approved_date = models.DateTimeField(blank=True, null=True)
    rejection_reason = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.employee.full_name} ({self.start_date} to {self.end_date}) [{self.status}]"
