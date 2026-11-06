from decimal import Decimal
from datetime import date, timedelta
from rest_framework import serializers
from django.db import transaction
from django.contrib.auth import get_user_model
from tenants.models import (
    Company, SubscriptionPlan, CompanySubscription,
    TenantDomain, CompanySetting, CompanyStatus, SubscriptionStatus
)
from accounts.models import Role

User = get_user_model()


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = [
            'id', 'name', 'tier', 'billing_cycle', 'price_inr',
            'max_employees', 'max_storage_mb', 'has_payroll_module',
            'has_pf_esi_compliance', 'has_geofencing_module',
            'has_early_pass_module', 'has_wfh_tracking', 'has_custom_reports',
            'is_active', 'created_at', 'updated_at'
        ]


class CompanySubscriptionSerializer(serializers.ModelSerializer):
    plan_name = serializers.CharField(source='plan.name', read_only=True)
    plan_tier = serializers.CharField(source='plan.tier', read_only=True)
    max_employees = serializers.IntegerField(source='plan.max_employees', read_only=True)
    days_remaining = serializers.IntegerField(read_only=True)
    is_in_grace_period = serializers.BooleanField(read_only=True)
    is_valid_or_in_grace = serializers.BooleanField(read_only=True)

    class Meta:
        model = CompanySubscription
        fields = [
            'id', 'company', 'plan', 'plan_name', 'plan_tier', 'max_employees',
            'status', 'start_date', 'expiry_date', 'grace_period_days',
            'auto_renew', 'last_payment_reference', 'payment_status',
            'days_remaining', 'is_in_grace_period', 'is_valid_or_in_grace',
            'created_at', 'updated_at'
        ]


class CompanySettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanySetting
        fields = [
            'id', 'company', 'company_logo', 'brand_color', 'company_tagline',
            'office_start_time', 'office_end_time', 'grace_period_minutes',
            'required_working_hours', 'half_day_threshold_hours',
            'salary_denominator_policy', 'optional_leave_annual_entitlement',
            'casual_leave_annual_entitlement', 'early_pass_max_per_month',
            'early_pass_min_working_hours', 'early_pass_allow_same_day',
            'early_pass_approval_role', 'updated_at'
        ]


class CompanySerializer(serializers.ModelSerializer):
    subscription = CompanySubscriptionSerializer(read_only=True)
    settings = CompanySettingSerializer(read_only=True)
    employee_count = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            'id', 'name', 'slug', 'contact_email', 'contact_phone',
            'address', 'industry', 'registration_number', 'tax_id_gstin',
            'status', 'is_master_tenant', 'employee_count',
            'subscription', 'settings', 'created_at', 'updated_at'
        ]

    def get_employee_count(self, obj):
        from employees.models import Employee
        return Employee.all_objects.filter(company=obj).count() if hasattr(Employee, 'all_objects') else Employee.objects.filter(company=obj).count()


class CompanyOnboardingSerializer(serializers.Serializer):
    """
    Handles end-to-end atomic provisioning of a new customer organization:
    1. Creates Company record with slug.
    2. Assigns Subscription Plan (with validity & grace period).
    3. Initializes default CompanySetting.
    4. Creates the primary Company Admin account.
    """
    company_name = serializers.CharField(max_length=150, required=False)
    name = serializers.CharField(max_length=150, required=False)
    slug = serializers.SlugField(max_length=100)
    contact_email = serializers.EmailField()
    contact_phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    industry = serializers.CharField(max_length=100, required=False, allow_blank=True)
    plan_id = serializers.IntegerField(required=False, allow_null=True)
    plan_tier = serializers.CharField(max_length=30, required=False, allow_blank=True)
    billing_cycle = serializers.CharField(max_length=20, required=False, allow_blank=True)

    # Admin User Details
    admin_name = serializers.CharField(max_length=150)
    admin_email = serializers.EmailField()
    admin_password = serializers.CharField(write_only=True, min_length=8)

    def validate_slug(self, value):
        val = value.strip().lower()
        if Company.objects.filter(slug=val).exists():
            raise serializers.ValidationError("A company with this URL slug already exists.")
        if val in ['admin', 'super-admin', 'api', 'static', 'media', 'auth']:
            raise serializers.ValidationError("This slug is reserved by the system.")
        return val

    def validate(self, attrs):
        cname = attrs.get('company_name') or attrs.get('name')
        if not cname:
            raise serializers.ValidationError({"company_name": "Company name is required."})
        cname = cname.strip()
        if Company.objects.filter(name__iexact=cname).exists():
            raise serializers.ValidationError({"company_name": "A company with this name already exists."})
        attrs['company_name'] = cname
        return attrs

    def validate_admin_email(self, value):
        val = value.strip().lower()
        if User.objects.filter(email=val).exists():
            raise serializers.ValidationError("A user with this email address is already registered.")
        return val

    def create(self, validated_data):
        company_name = validated_data['company_name']
        slug = validated_data['slug']
        contact_email = validated_data['contact_email']
        contact_phone = validated_data.get('contact_phone', '')
        address = validated_data.get('address', '')
        industry = validated_data.get('industry', '')
        plan_id = validated_data.get('plan_id')
        plan_tier = validated_data.get('plan_tier')
        billing_cycle = validated_data.get('billing_cycle', 'MONTHLY')

        admin_name = validated_data['admin_name']
        admin_email = validated_data['admin_email']
        admin_password = validated_data['admin_password']

        with transaction.atomic():
            # 1. Create Company
            company = Company.objects.create(
                name=company_name,
                slug=slug,
                contact_email=contact_email,
                contact_phone=contact_phone,
                address=address,
                industry=industry,
                status=CompanyStatus.ACTIVE
            )

            # 2. Assign Subscription Plan
            plan = None
            if plan_id:
                plan = SubscriptionPlan.objects.filter(id=plan_id, is_active=True).first()
            if not plan and plan_tier:
                plan = SubscriptionPlan.objects.filter(tier=plan_tier, is_active=True).first()
            if not plan:
                plan = SubscriptionPlan.objects.filter(tier=PlanTier.STARTER, is_active=True).first()
                if not plan:
                    plan = SubscriptionPlan.objects.create(
                        name="Starter Plan",
                        tier=PlanTier.STARTER,
                        billing_cycle="MONTHLY",
                        price_inr=Decimal('4999.00'),
                        max_employees=25
                    )

            cycle = billing_cycle or plan.billing_cycle
            expiry = date.today() + timedelta(days=365 if cycle == 'YEARLY' else 30)
            CompanySubscription.objects.create(
                company=company,
                plan=plan,
                status=SubscriptionStatus.ACTIVE,
                start_date=date.today(),
                expiry_date=expiry,
                grace_period_days=7
            )

            # 3. Initialize Company Settings
            CompanySetting.objects.create(
                company=company,
                company_tagline=f"Official Workspace Portal for {company_name}"
            )

            # 4. Create Company Admin User
            names = admin_name.split(' ', 1)
            first_name = names[0]
            last_name = names[1] if len(names) > 1 else ''

            admin_user = User.objects.create_user(
                email=admin_email,
                username=admin_email.split('@')[0],
                password=admin_password,
                first_name=first_name,
                last_name=last_name,
                role=Role.CEO
            )
            if hasattr(admin_user, 'company'):
                admin_user.company = company
                admin_user.save(update_fields=['company'])

        return company

