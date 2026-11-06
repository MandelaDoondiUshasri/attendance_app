from django.db import migrations

def link_existing_records(apps, schema_editor):
    Company = apps.get_model('tenants', 'Company')
    master = Company.objects.filter(is_master_tenant=True).first()
    if not master:
        return

    # User
    User = apps.get_model('accounts', 'User')
    User.objects.filter(company__isnull=True).update(company=master)

    # Employees
    Department = apps.get_model('employees', 'Department')
    Designation = apps.get_model('employees', 'Designation')
    Employee = apps.get_model('employees', 'Employee')
    Department.objects.filter(company__isnull=True).update(company=master)
    Designation.objects.filter(company__isnull=True).update(company=master)
    Employee.objects.filter(company__isnull=True).update(company=master)

    # Core
    OrganizationSettings = apps.get_model('core', 'OrganizationSettings')
    Holiday = apps.get_model('core', 'Holiday')
    OrganizationSettings.objects.filter(company__isnull=True).update(company=master)
    Holiday.objects.filter(company__isnull=True).update(company=master)

    # Attendance
    FestivalHoliday = apps.get_model('attendance', 'FestivalHoliday')
    FestivalHoliday.objects.filter(company__isnull=True).update(company=master)

    # Leaves
    LeaveType = apps.get_model('leaves', 'LeaveType')
    LeaveType.objects.filter(company__isnull=True).update(company=master)

    # Salaries
    PFConfiguration = apps.get_model('salaries', 'PFConfiguration')
    Payroll = apps.get_model('salaries', 'Payroll')
    SalaryStructure = apps.get_model('salaries', 'SalaryStructure')
    PFConfiguration.objects.filter(company__isnull=True).update(company=master)
    Payroll.objects.filter(company__isnull=True).update(company=master)
    SalaryStructure.objects.filter(company__isnull=True).update(company=master)

def reverse_link(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0002_seed_master_tenant'),
        ('accounts', '0006_user_company_alter_user_role'),
        ('attendance', '0014_festivalholiday_company'),
        ('core', '0006_holiday_company_organizationsettings_company'),
        ('employees', '0008_department_company_designation_company_and_more'),
        ('leaves', '0007_leavetype_company'),
        ('salaries', '0007_payroll_company_pfconfiguration_company_and_more'),
    ]

    operations = [
        migrations.RunPython(link_existing_records, reverse_link),
    ]

