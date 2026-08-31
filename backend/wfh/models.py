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
    start_date = models.DateField(db_index=True, null=True)
    end_date = models.DateField(db_index=True, null=True, blank=True)
    number_of_days = models.FloatField(default=1.0)
    is_half_day = models.BooleanField(default=False)
    half_day_period = models.CharField(max_length=20, null=True, blank=True)
    reason = models.TextField()
    attachment = models.FileField(upload_to='wfh/', blank=True, null=True)
    status = models.CharField(max_length=20, choices=WFHStatus.choices, default=WFHStatus.PENDING, db_index=True)

    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_wfh_requests')
    rejection_reason = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.end_date and self.start_date and self.end_date < self.start_date:
            raise ValidationError("End date cannot be earlier than start date.")
        
        # Check overlaps
        qs = WFHRequest.objects.filter(
            employee=self.employee,
            status__in=[WFHStatus.PENDING, WFHStatus.APPROVED],
            start_date__lte=self.end_date,
            end_date__gte=self.start_date
        )
        if self.pk:
            qs = qs.exclude(pk=self.pk)
            
        if qs.exists():
            raise ValidationError("You already have an existing WFH request for this date range.")

    def save(self, *args, **kwargs):
        self.clean()
        if not self.end_date:
            self.end_date = self.start_date
        super().save(*args, **kwargs)

    class Meta:
        ordering = ['-start_date']

    def __str__(self):
        return f"WFH Request: {self.employee.full_name} ({self.start_date} to {self.end_date}) [{self.status}]"
