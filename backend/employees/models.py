from django.db import models
from django.conf import settings

class WorkMode(models.TextChoices):
    OFFICE = 'OFFICE', 'Office'
    WFH = 'WFH', 'Work From Home'
    HYBRID = 'HYBRID', 'Hybrid'

class EmploymentStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Active'
    INACTIVE = 'INACTIVE', 'Inactive'
    PROBATION = 'PROBATION', 'Probation'
    TERMINATED = 'TERMINATED', 'Terminated'

class Department(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Designation(models.Model):
    title = models.CharField(max_length=100)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='designations')
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['title', 'department']

    def __str__(self):
        return f"{self.title} ({self.department.name})"

class Employee(models.Model):
    employee_id = models.CharField(max_length=30, unique=True, db_index=True)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='employee_profile')
    full_name = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    dob = models.DateField(blank=True, null=True)
    gender = models.CharField(max_length=20, blank=True, null=True)
    emergency_contact = models.CharField(max_length=50, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    profile_photo = models.ImageField(upload_to='profiles/', blank=True, null=True)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='employees')
    designation = models.ForeignKey(Designation, on_delete=models.SET_NULL, null=True, blank=True, related_name='employees')
    joining_date = models.DateField()
    work_mode = models.CharField(max_length=20, choices=WorkMode.choices, default=WorkMode.OFFICE)
    manager = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='subordinates')
    employment_status = models.CharField(max_length=20, choices=EmploymentStatus.choices, default=EmploymentStatus.ACTIVE)
    salary = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    leave_balance = models.FloatField(default=24.0)
    is_half_day = models.BooleanField(default=False)
    mobile_access_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.full_name} ({self.employee_id})"
