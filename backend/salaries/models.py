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
