import uuid
from datetime import date, timedelta
from decimal import Decimal
from django.db import models
from django.utils import timezone


class CompanyStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Active'
    ONBOARDING = 'ONBOARDING', 'Onboarding Pending'
    SUSPENDED = 'SUSPENDED', 'Suspended'
    DEACTIVATED = 'DEACTIVATED', 'Deactivated'


class Company(models.Model):
    """
    Core Tenant Model representing an independent customer organization.
    All company-scoped records (users, employees, attendances, payroll, settings)
    are strictly associated with a Company instance.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150, unique=True, db_index=True)
    slug = models.SlugField(max_length=100, unique=True, db_index=True)

    # Contact & Registration Details
    contact_email = models.EmailField()
    contact_phone = models.CharField(max_length=30, blank=True, default='')
    address = models.TextField(blank=True, default='')
    industry = models.CharField(max_length=100, blank=True, default='')
    registration_number = models.CharField(max_length=100, blank=True, default='')
    tax_id_gstin = models.CharField(max_length=50, blank=True, default='')

    # Lifecycle & Protection
    status = models.CharField(
        max_length=20,
        choices=CompanyStatus.choices,
        default=CompanyStatus.ACTIVE,
        db_index=True
    )
    is_master_tenant = models.BooleanField(
        default=False,
        help_text="Marks the original enterprise (FRG Enterprise) as the protected default tenant."
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Company (Tenant)'
        verbose_name_plural = 'Companies (Tenants)'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} [{self.slug}] ({self.get_status_display()})"


class PlanTier(models.TextChoices):
    STARTER = 'STARTER', 'Starter Plan'
    PROFESSIONAL = 'PROFESSIONAL', 'Professional Plan'
    ENTERPRISE = 'ENTERPRISE', 'Enterprise Plan'


class BillingCycle(models.TextChoices):
    MONTHLY = 'MONTHLY', 'Monthly'
    QUARTERLY = 'QUARTERLY', 'Quarterly'
    YEARLY = 'YEARLY', 'Yearly'


class SubscriptionPlan(models.Model):
    """
    Commercial SaaS subscription plan tiers configuring employee limits,
    storage allocations, pricing, and feature gating.
    """
    name = models.CharField(max_length=100, unique=True)
    tier = models.CharField(max_length=30, choices=PlanTier.choices, default=PlanTier.STARTER)
    billing_cycle = models.CharField(max_length=20, choices=BillingCycle.choices, default=BillingCycle.MONTHLY)
    price_inr = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('4999.00'))
    max_employees = models.PositiveIntegerField(default=25, help_text="Maximum allowed active employees under this plan")
    max_storage_mb = models.PositiveIntegerField(default=5000, help_text="Storage quota in MB for media and reports")

    # Feature Flags
    has_payroll_module = models.BooleanField(default=True)
    has_pf_esi_compliance = models.BooleanField(default=True)
    has_geofencing_module = models.BooleanField(default=True)
    has_early_pass_module = models.BooleanField(default=True)
    has_wfh_tracking = models.BooleanField(default=True)
    has_custom_reports = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['price_inr', 'max_employees']

    def __str__(self):
        return f"{self.name} (₹{self.price_inr} / {self.get_billing_cycle_display()} - Up to {self.max_employees} Staff)"


class SubscriptionStatus(models.TextChoices):
    TRIAL = 'TRIAL', 'Free Trial'
    ACTIVE = 'ACTIVE', 'Active Subscription'
    GRACE_PERIOD = 'GRACE_PERIOD', 'In Grace Period'
    SUSPENDED = 'SUSPENDED', 'Suspended / Payment Due'
    EXPIRED = 'EXPIRED', 'Expired'
    CANCELLED = 'CANCELLED', 'Cancelled'


class CompanySubscription(models.Model):
    """
    Tracks an organization's active subscription, validity window, grace period,
    and payment status.
    """
    company = models.OneToOneField(Company, on_delete=models.CASCADE, related_name='subscription')
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT, related_name='active_subscriptions')
    status = models.CharField(
        max_length=25,
        choices=SubscriptionStatus.choices,
        default=SubscriptionStatus.ACTIVE,
        db_index=True
    )
    start_date = models.DateField(default=date.today)
    expiry_date = models.DateField()
    grace_period_days = models.PositiveIntegerField(default=7, help_text="Buffer days allowed after expiry before service suspension")
    auto_renew = models.BooleanField(default=True)
    last_payment_reference = models.CharField(max_length=100, blank=True, default='')
    payment_status = models.CharField(max_length=30, default='PAID')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-expiry_date']

    def __str__(self):
        return f"{self.company.name} -> {self.plan.name} (Valid till: {self.expiry_date})"

    @property
    def is_valid_or_in_grace(self) -> bool:
        """
        Determines whether the subscription allows operational access (active or within grace period).
        """
        if self.company.status == CompanyStatus.SUSPENDED or self.status == SubscriptionStatus.SUSPENDED:
            return False
        today = date.today()
        effective_deadline = self.expiry_date + timedelta(days=self.grace_period_days)
        return today <= effective_deadline

    @property
    def is_in_grace_period(self) -> bool:
        today = date.today()
        return self.expiry_date < today <= (self.expiry_date + timedelta(days=self.grace_period_days))

    @property
    def days_remaining(self) -> int:
        today = date.today()
        return (self.expiry_date - today).days

    def can_add_employee(self, current_employee_count: int) -> bool:
        """
        Validates if adding another employee respects the plan's headcount ceiling.
        """
        return current_employee_count < self.plan.max_employees


class TenantDomain(models.Model):
    """
    Maps subdomains and custom corporate domains to a specific company tenant.
    e.g. companya.frgattendance.com -> Company A
    """
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='domains')
    domain = models.CharField(max_length=255, unique=True, db_index=True)
    is_primary = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.domain} -> {self.company.name}"


class CompanySetting(models.Model):
    """
    Company-specific branding, working hours, and operational policies.
    Guarantees that each tenant customizes its own instance without impacting other companies.
    """
    company = models.OneToOneField(Company, on_delete=models.CASCADE, related_name='settings')
    company_logo = models.ImageField(upload_to='branding/tenants/', blank=True, null=True)
    brand_color = models.CharField(max_length=30, default='#2563eb')
    company_tagline = models.CharField(max_length=200, default='Secure Enterprise Workspace Portal', blank=True)

    # Work hours and attendance thresholds
    office_start_time = models.CharField(max_length=10, default='09:00')
    office_end_time = models.CharField(max_length=10, default='18:00')
    grace_period_minutes = models.IntegerField(default=15)
    required_working_hours = models.DecimalField(max_digits=4, decimal_places=2, default=Decimal('8.00'))
    half_day_threshold_hours = models.DecimalField(max_digits=4, decimal_places=2, default=Decimal('4.00'))
    salary_denominator_policy = models.CharField(
        max_length=30,
        default='EFFECTIVE_WORKING_DAYS'
    )
    optional_leave_annual_entitlement = models.FloatField(default=1.0)
    casual_leave_annual_entitlement = models.FloatField(default=12.0)

    # EarlyPass rules
    early_pass_max_per_month = models.PositiveIntegerField(default=3)
    early_pass_min_working_hours = models.DecimalField(max_digits=4, decimal_places=2, default=Decimal('4.00'))
    early_pass_allow_same_day = models.BooleanField(default=True)
    early_pass_approval_role = models.CharField(max_length=20, default='HR_OR_CEO')

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.company.name} Settings"

