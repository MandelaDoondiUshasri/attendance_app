from django.db import models
from employees.models import Employee

class EmployeeScreenTime(models.Model):
    """
    Persists active screen time accumulated by each employee per calendar day.
    """
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='screen_times')
    date = models.DateField(db_index=True)
    active_seconds = models.PositiveIntegerField(default=0)
    last_heartbeat = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('employee', 'date')
        ordering = ['-date']

    def __str__(self):
        return f"{self.employee.full_name} - {self.date}: {self.active_seconds}s"
