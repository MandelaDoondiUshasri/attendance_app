from django.db import migrations
from django.contrib.auth.hashers import make_password


def create_or_update_superadmin(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    Company = apps.get_model('tenants', 'Company')

    email = 'superadmin@attendx.com'
    password_hash = make_password('AttendXSuperAdmin@2026!')

    user = User.objects.filter(email__iexact=email).first()
    if not user:
        User.objects.create(
            email=email,
            username='superadmin',
            first_name='AttendX',
            last_name='Super Admin',
            role='SUPER_ADMIN',
            company=None,
            is_staff=True,
            is_superuser=True,
            is_active=True,
            password=password_hash
        )
    else:
        user.role = 'SUPER_ADMIN'
        user.company = None
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.first_name = 'AttendX'
        user.last_name = 'Super Admin'
        user.password = password_hash
        user.save()

    # Enforce company module entitlements:
    # 1. Master Tenant (FRG) has Maintenance Ops
    frg = Company.objects.filter(slug='frg').first() or Company.objects.filter(is_master_tenant=True).first()
    if frg:
        frg.has_maintenance_module = True
        frg.save(update_fields=['has_maintenance_module'])

    # 2. First Care Pharmacy does NOT have Maintenance Ops
    fcp = Company.objects.filter(slug='first-care-pharmacy').first()
    if fcp:
        fcp.has_maintenance_module = False
        fcp.save(update_fields=['has_maintenance_module'])


def rollback_superadmin(apps, schema_editor):
    # Safe no-op on rollback
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0004_company_has_maintenance_module'),
        ('accounts', '0006_user_company_alter_user_role'),
    ]

    operations = [
        migrations.RunPython(create_or_update_superadmin, rollback_superadmin),
    ]

