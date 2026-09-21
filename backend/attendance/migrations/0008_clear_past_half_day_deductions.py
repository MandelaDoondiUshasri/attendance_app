import datetime
from django.db import migrations


def clear_past_half_days(apps, schema_editor):
    Attendance = apps.get_model('attendance', 'Attendance')
    cutoff = datetime.date(2026, 9, 21)
    updated_count = Attendance.objects.filter(
        date__lte=cutoff,
        status='HALF_DAY'
    ).update(status='PRESENT')
    if updated_count:
        print(f"Updated {updated_count} past HALF_DAY attendance records up to {cutoff} to PRESENT.")


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0007_festivalholiday'),
    ]

    operations = [
        migrations.RunPython(clear_past_half_days, migrations.RunPython.noop),
    ]
