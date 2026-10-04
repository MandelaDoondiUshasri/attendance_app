from django.db import migrations

def create_loss_of_pay_type(apps, schema_editor):
    LeaveType = apps.get_model('leaves', 'LeaveType')
    lop = LeaveType.objects.filter(code='LOP').first()
    if not lop:
        lop = LeaveType.objects.filter(name__iexact='Loss of Pay').first()
    
    if lop:
        lop.code = 'LOP'
        lop.name = 'Loss of Pay'
        lop.is_paid = False
        lop.days_allowed = 0
        lop.save()
    else:
        LeaveType.objects.create(
            name='Loss of Pay',
            code='LOP',
            days_allowed=0,
            is_paid=False
        )

def remove_loss_of_pay_type(apps, schema_editor):
    LeaveType = apps.get_model('leaves', 'LeaveType')
    LeaveType.objects.filter(code='LOP').delete()

class Migration(migrations.Migration):

    dependencies = [
        ('leaves', '0004_leavetype_is_paid'),
    ]

    operations = [
        migrations.RunPython(create_loss_of_pay_type, reverse_code=remove_loss_of_pay_type),
    ]
