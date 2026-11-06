from django.db import migrations
from datetime import date
from decimal import Decimal


def seed_master_tenant(apps, schema_editor):
    Company = apps.get_model('tenants', 'Company')
    SubscriptionPlan = apps.get_model('tenants', 'SubscriptionPlan')
    CompanySubscription = apps.get_model('tenants', 'CompanySubscription')
    CompanySetting = apps.get_model('tenants', 'CompanySetting')
    TenantDomain = apps.get_model('tenants', 'TenantDomain')

    # 1. Standard Commercial Plans
    starter, _ = SubscriptionPlan.objects.get_or_create(
        name="Starter Plan",
        defaults={
            'tier': 'STARTER',
            'billing_cycle': 'MONTHLY',
            'price_inr': Decimal('4999.00'),
            'max_employees': 25,
            'max_storage_mb': 5000,
            'has_payroll_module': True,
            'has_pf_esi_compliance': True,
            'has_geofencing_module': True,
            'has_early_pass_module': True,
            'has_wfh_tracking': True,
            'has_custom_reports': True,
            'is_active': True,
        }
    )

    pro, _ = SubscriptionPlan.objects.get_or_create(
        name="Professional Plan",
        defaults={
            'tier': 'PROFESSIONAL',
            'billing_cycle': 'MONTHLY',
            'price_inr': Decimal('14999.00'),
            'max_employees': 100,
            'max_storage_mb': 25000,
            'has_payroll_module': True,
            'has_pf_esi_compliance': True,
            'has_geofencing_module': True,
            'has_early_pass_module': True,
            'has_wfh_tracking': True,
            'has_custom_reports': True,
            'is_active': True,
        }
    )

    enterprise, _ = SubscriptionPlan.objects.get_or_create(
        name="Enterprise Plan",
        defaults={
            'tier': 'ENTERPRISE',
            'billing_cycle': 'YEARLY',
            'price_inr': Decimal('39999.00'),
            'max_employees': 1000000,
            'max_storage_mb': 100000,
            'has_payroll_module': True,
            'has_pf_esi_compliance': True,
            'has_geofencing_module': True,
            'has_early_pass_module': True,
            'has_wfh_tracking': True,
            'has_custom_reports': True,
            'is_active': True,
        }
    )

    # 2. Master Tenant (Tenant 1: FRG Enterprise - Protected Existing Company)
    master_company, _ = Company.objects.get_or_create(
        slug="frg",
        defaults={
            'name': "FRG Enterprise",
            'contact_email': "hr@frgenterprise.com",
            'contact_phone': "+91 40 1234 5678",
            'address': "Plot No. 42, Hitech City, Hyderabad, Telangana - 500081",
            'industry': "Information Technology & Software Services",
            'status': "ACTIVE",
            'is_master_tenant': True,
        }
    )

    if not master_company.is_master_tenant:
        master_company.is_master_tenant = True
        master_company.save()

    # 3. Master Tenant Subscription
    if not CompanySubscription.objects.filter(company=master_company).exists():
        CompanySubscription.objects.create(
            company=master_company,
            plan=enterprise,
            status='ACTIVE',
            start_date=date(2026, 1, 1),
            expiry_date=date(2036, 1, 1), # 10 years validity
            grace_period_days=30,
            auto_renew=True,
            payment_status='PAID'
        )

    # 4. Master Tenant Settings
    if not CompanySetting.objects.filter(company=master_company).exists():
        CompanySetting.objects.create(
            company=master_company,
            company_tagline="Secure Enterprise Workspace Portal",
            brand_color="#2563eb",
            office_start_time="09:00",
            office_end_time="18:00",
            grace_period_minutes=15,
            required_working_hours=Decimal('8.00'),
            half_day_threshold_hours=Decimal('4.00'),
        )

    # 5. Master Tenant Domain
    TenantDomain.objects.get_or_create(
        domain="frg.attendance.com",
        defaults={
            'company': master_company,
            'is_primary': True,
            'is_verified': True,
        }
    )


def reverse_seed_master_tenant(apps, schema_editor):
    Company = apps.get_model('tenants', 'Company')
    SubscriptionPlan = apps.get_model('tenants', 'SubscriptionPlan')
    Company.objects.filter(slug='frg').delete()
    SubscriptionPlan.objects.filter(name__in=["Starter Plan", "Professional Plan", "Enterprise Plan"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_master_tenant, reverse_seed_master_tenant),
    ]

