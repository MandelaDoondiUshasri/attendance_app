from django.core.management.base import BaseCommand
from accounts.models import User, Role
from employees.models import Employee
from attendance.models import Attendance, AttendanceCorrectionRequest
from leaves.models import LeaveRequest
from wfh.models import WFHRequest
from salaries.models import SalaryHistory
from audit.models import AuditLog

class Command(BaseCommand):
    help = 'Clears all sample/dummy attendance logs, leave requests, WFH requests, and test employees'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Cleaning dummy/sample data from database...'))

        # 1. Delete all attendance and corrections
        att_count = Attendance.objects.all().delete()[0]
        corr_count = AttendanceCorrectionRequest.objects.all().delete()[0]
        self.stdout.write(f'  - Removed {att_count} attendance records and {corr_count} corrections.')

        # 2. Delete all leave and WFH requests
        leave_count = LeaveRequest.objects.all().delete()[0]
        wfh_count = WFHRequest.objects.all().delete()[0]
        self.stdout.write(f'  - Removed {leave_count} leave requests and {wfh_count} WFH requests.')

        # 3. Delete salary history records
        sal_hist_count = SalaryHistory.objects.all().delete()[0]
        self.stdout.write(f'  - Removed {sal_hist_count} salary history records.')

        # 4. Delete dummy test employees (emp1, emp2)
        dummy_emails = ['emp1@company.com', 'emp2@company.com']
        deleted_users = User.objects.filter(email__in=dummy_emails).delete()[0]
        self.stdout.write(f'  - Removed {deleted_users} dummy sample users/employees ({", ".join(dummy_emails)}).')

        self.stdout.write(self.style.SUCCESS('Successfully cleaned all dummy records! Database is clean for production.'))
