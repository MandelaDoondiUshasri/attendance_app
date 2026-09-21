import datetime
from django.core.management.base import BaseCommand
from attendance.models import Attendance, AttendanceStatus


class Command(BaseCommand):
    help = 'Clears all past HALF_DAY attendance records and deductions up to today (2026-09-21) to PRESENT.'

    def handle(self, *args, **options):
        cutoff = datetime.date(2026, 9, 21)
        updated = Attendance.objects.filter(
            date__lte=cutoff,
            status=AttendanceStatus.HALF_DAY
        ).update(status=AttendanceStatus.PRESENT)

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully updated {updated} past HALF_DAY attendance records up to {cutoff} to PRESENT.'
            )
        )
