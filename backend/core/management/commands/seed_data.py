from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import date, datetime
from decimal import Decimal
from accounts.models import User, Role
from employees.models import Employee, Department, Designation, WorkMode
from biometrics.models import BiometricDevice, DeviceType
from leaves.models import LeaveType
from core.models import OrganizationSettings
from audit.services import AuditService

class Command(BaseCommand):
    help = 'Initializes production organizational structure and initial administrator accounts'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting organizational initialization...'))

        # 1. Organization Settings
        org_settings = OrganizationSettings.get_settings()
        org_settings.company_name = "FRG Enterprise"
        org_settings.office_start_time = "09:00"
        org_settings.office_end_time = "18:00"
        org_settings.grace_period_minutes = 15
        org_settings.required_working_hours = Decimal('8.00')
        org_settings.save()
        self.stdout.write('  [OK] Organization Settings configured.')

        # 2. Departments
        eng_dept, _ = Department.objects.get_or_create(name='Engineering', defaults={'code': 'ENG', 'description': 'Software Engineering and Architecture'})
        hr_dept, _ = Department.objects.get_or_create(name='Human Resources', defaults={'code': 'HR', 'description': 'HR Operations and Administration'})
        sales_dept, _ = Department.objects.get_or_create(name='Sales & Marketing', defaults={'code': 'SALES', 'description': 'Global Sales and Growth'})
        fin_dept, _ = Department.objects.get_or_create(name='Finance', defaults={'code': 'FIN', 'description': 'Accounting and Financial Management'})
        self.stdout.write('  [OK] Departments initialized.')

        # 3. Designations
        ceo_desg, _ = Designation.objects.get_or_create(title='Chief Executive Officer', defaults={'department': hr_dept})
        hr_mgr_desg, _ = Designation.objects.get_or_create(title='HR Manager', defaults={'department': hr_dept})
        op_desg, _ = Designation.objects.get_or_create(title='Attendance Operator', defaults={'department': hr_dept})
        arch_desg, _ = Designation.objects.get_or_create(title='Senior Software Architect', defaults={'department': eng_dept})
        dev_desg, _ = Designation.objects.get_or_create(title='Software Engineer', defaults={'department': eng_dept})
        self.stdout.write('  [OK] Designations initialized.')

        # 4. Leave Types
        LeaveType.objects.get_or_create(name='Paid Leave', defaults={'code': 'PL', 'days_allowed': 12})
        LeaveType.objects.get_or_create(name='Casual Leave', defaults={'code': 'CL', 'days_allowed': 8})
        LeaveType.objects.get_or_create(name='Sick Leave', defaults={'code': 'SL', 'days_allowed': 6})
        self.stdout.write('  [OK] Leave Types initialized.')

        # 5. Biometric Devices
        BiometricDevice.objects.get_or_create(
            device_id='FRG-FACE-01',
            defaults={'name': 'Main Entrance Face Terminal', 'device_type': DeviceType.FACE, 'location_name': 'Lobby Entrance', 'is_online': True}
        )
        BiometricDevice.objects.get_or_create(
            device_id='FRG-FP-01',
            defaults={'name': 'HQ Optical Fingerprint Scanner', 'device_type': DeviceType.FINGERPRINT, 'location_name': 'Security Gate 1', 'is_online': True}
        )
        self.stdout.write('  [OK] Biometric Devices initialized.')

        # 6. Core Administrator Accounts
        ceo_user, _ = User.objects.get_or_create(
            email='md.3capstech@gmail.com',
            defaults={
                'username': 'ceo',
                'first_name': 'Alexander',
                'last_name': 'Vance',
                'role': Role.CEO,
                'is_staff': True,
                'is_superuser': True
            }
        )
        ceo_user.set_password('@3Caps!23456$')
        ceo_user.save()

        Employee.objects.get_or_create(
            user=ceo_user,
            defaults={
                'employee_id': 'EMP-1000',
                'full_name': 'Alexander Vance',
                'email': 'md.3capstech@gmail.com',
                'department': hr_dept,
                'designation': ceo_desg,
                'joining_date': date.today(),
                'work_mode': WorkMode.OFFICE,
                'salary': Decimal('250000.00'),
                'leave_balance': 30,
                'face_profile_enrolled': True
            }
        )

        hr_user, _ = User.objects.get_or_create(
            email='hr@company.com',
            defaults={
                'username': 'hr_admin',
                'first_name': 'Sarah',
                'last_name': 'Jenkins',
                'role': Role.HR,
                'is_staff': True
            }
        )
        hr_user.set_password('Password123!')
        hr_user.save()

        Employee.objects.get_or_create(
            user=hr_user,
            defaults={
                'employee_id': 'EMP-1001',
                'full_name': 'Sarah Jenkins',
                'email': 'hr@company.com',
                'department': hr_dept,
                'designation': hr_mgr_desg,
                'joining_date': date.today(),
                'work_mode': WorkMode.OFFICE,
                'salary': Decimal('120000.00'),
                'leave_balance': 24,
                'face_profile_enrolled': True
            }
        )

        op_user, _ = User.objects.get_or_create(
            email='operator@company.com',
            defaults={
                'username': 'operator',
                'first_name': 'Marcus',
                'last_name': 'Brody',
                'role': Role.ATTENDANCE_OPERATOR
            }
        )
        op_user.set_password('Password123!')
        op_user.save()

        Employee.objects.get_or_create(
            user=op_user,
            defaults={
                'employee_id': 'EMP-1002',
                'full_name': 'Marcus Brody',
                'email': 'operator@company.com',
                'department': hr_dept,
                'designation': op_desg,
                'joining_date': date.today(),
                'work_mode': WorkMode.OFFICE,
                'salary': Decimal('60000.00'),
                'leave_balance': 20,
                'face_profile_enrolled': True
            }
        )
        self.stdout.write('  [OK] Core Production Admin Accounts active.')

        # 7. Initial System Audit Entry
        AuditService.log_action(
            actor=ceo_user,
            action='SYSTEM_INITIALIZATION',
            reason='Clean organizational structure initialized for production environment',
        )

        self.stdout.write(self.style.SUCCESS('\n======================================================'))
        self.stdout.write(self.style.SUCCESS(' PRODUCTION INITIALIZATION COMPLETE! NO DUMMY DATA!'))
        self.stdout.write(self.style.SUCCESS('======================================================\n'))
