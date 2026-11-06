from django.db import migrations


def set_attendx_platform_branding(apps, schema_editor):
    OrganizationSettings = apps.get_model('core', 'OrganizationSettings')
    Company = apps.get_model('tenants', 'Company')
    CompanySetting = apps.get_model('tenants', 'CompanySetting')

    org_setting = OrganizationSettings.objects.filter(id=1).first()
    if org_setting:
        # If existing setting has Fortune Rise info, move it to CompanySetting for FRG
        frg_company = Company.objects.filter(slug='frg').first() or Company.objects.filter(is_master_tenant=True).first()
        if frg_company:
            comp_setting, _ = CompanySetting.objects.get_or_create(company=frg_company)
            if 'FORTUNE' in (org_setting.company_name or '').upper():
                comp_setting.company_tagline = org_setting.company_tagline or "Fortune Rise Groups Workspace"
                if org_setting.company_logo:
                    comp_setting.company_logo = org_setting.company_logo
                comp_setting.save()

        # Update global default OrganizationSettings to ATTENDX platform branding
        org_setting.company_name = 'ATTENDX'
        org_setting.company_tagline = 'Enterprise Attendance & Workforce Suite'
        org_setting.contact_email = 'support@attendx.com'
        org_setting.company_logo = None
        org_setting.save()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0007_alter_organizationsettings_company_name_and_more'),
        ('tenants', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(set_attendx_platform_branding, migrations.RunPython.noop),
    ]

