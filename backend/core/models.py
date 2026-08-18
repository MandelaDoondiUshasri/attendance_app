from django.db import models

class OrganizationSettings(models.Model):
    company_name = models.CharField(max_length=150, default="Enterprise HR Corp")
    office_start_time = models.CharField(max_length=10, default="09:00")
    office_end_time = models.CharField(max_length=10, default="18:00")
    grace_period_minutes = models.IntegerField(default=15)
    required_working_hours = models.DecimalField(max_digits=4, decimal_places=2, default=8.00)
    half_day_threshold_hours = models.DecimalField(max_digits=4, decimal_places=2, default=4.00)
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def get_settings(cls):
        obj, _ = cls.objects.get_or_create(id=1)
        return obj

    def __str__(self):
        return f"{self.company_name} Settings"

class Holiday(models.Model):
    title = models.CharField(max_length=100)
    date = models.DateField(unique=True)
    description = models.TextField(blank=True, null=True)
    is_optional = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date']

    def __str__(self):
        return f"{self.title} ({self.date})"
