from django.db import models

class SalaryDenominatorPolicy(models.TextChoices):
    EFFECTIVE_WORKING_DAYS = 'EFFECTIVE_WORKING_DAYS', 'Effective Working Days (Working Days - Paid Leaves)'
    SCHEDULED_WORKING_DAYS = 'SCHEDULED_WORKING_DAYS', 'Scheduled Company Working Days'
    CALENDAR_DAYS = 'CALENDAR_DAYS', 'Calendar Days'
    FIXED_30 = 'FIXED_30', 'Fixed 30 Days'
    FIXED_26 = 'FIXED_26', 'Fixed 26 Days'

class OrganizationSettings(models.Model):
    company_name = models.CharField(max_length=150, default="FRG Enterprise")
    company_logo = models.ImageField(upload_to='branding/', blank=True, null=True)
    company_tagline = models.CharField(max_length=200, default="Secure Enterprise Workspace Portal", blank=True)
    office_start_time = models.CharField(max_length=10, default="09:00")
    office_end_time = models.CharField(max_length=10, default="18:00")
    grace_period_minutes = models.IntegerField(default=15)
    required_working_hours = models.DecimalField(max_digits=4, decimal_places=2, default=8.00)
    half_day_threshold_hours = models.DecimalField(max_digits=4, decimal_places=2, default=4.00)
    salary_denominator_policy = models.CharField(
        max_length=30,
        choices=SalaryDenominatorPolicy.choices,
        default=SalaryDenominatorPolicy.EFFECTIVE_WORKING_DAYS
    )
    optional_leave_annual_entitlement = models.FloatField(default=1.0)
    casual_leave_annual_entitlement = models.FloatField(default=12.0)
    standard_daily_work_hours = models.DecimalField(max_digits=4, decimal_places=2, default=8.00)
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
