from django.db import models
from django.conf import settings
from employees.models import Employee

class WFHStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Approval'
    APPROVED = 'APPROVED', 'Approved'
    REJECTED = 'REJECTED', 'Rejected'
    CANCELLED = 'CANCELLED', 'Cancelled'

class WFHRequest(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='wfh_requests')
    date = models.DateField(db_index=True)
    reason = models.TextField()
    attachment = models.FileField(upload_to='wfh/', blank=True, null=True)
    status = models.CharField(max_length=20, choices=WFHStatus.choices, default=WFHStatus.PENDING, db_index=True)

    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_wfh_requests')
    rejection_reason = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['employee', 'date']
        ordering = ['-date']

    def __str__(self):
        return f"WFH Request: {self.employee.full_name} ({self.date}) [{self.status}]"
