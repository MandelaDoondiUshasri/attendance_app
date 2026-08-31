from django.db import models
from django.conf import settings
from employees.models import Employee, WorkMode

class LeaveStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Approval'
    APPROVED = 'APPROVED', 'Approved'
    REJECTED = 'REJECTED', 'Rejected'
    CANCELLED = 'CANCELLED', 'Cancelled'

class LeaveType(models.Model):
    name = models.CharField(max_length=50, unique=True) # e.g. Paid Leave, Casual Leave, Sick Leave
    code = models.CharField(max_length=20, unique=True)
    days_allowed = models.IntegerField(default=12)

    def __str__(self):
        return self.name

class LeaveBalance(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='leave_balances')
    leave_type = models.ForeignKey(LeaveType, on_delete=models.CASCADE)
    remaining_days = models.FloatField(default=12.0)

    class Meta:
        unique_together = ['employee', 'leave_type']

    def __str__(self):
        return f"{self.employee.full_name} - {self.leave_type.name}: {self.remaining_days} days"

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

    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_leaves')
    approved_date = models.DateTimeField(blank=True, null=True)
    rejection_reason = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.employee.full_name} ({self.start_date} to {self.end_date}) [{self.status}]"
