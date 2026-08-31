from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import date, datetime
from decimal import Decimal
from accounts.models import User, Role
from employees.models import Employee, Department, Designation, WorkMode

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
        arch_desg, _ = Designation.objects.get_or_create(title='Senior Software Architect', defaults={'department': eng_dept})
        dev_desg, _ = Designation.objects.get_or_create(title='Software Engineer', defaults={'department': eng_dept})
        self.stdout.write('  [OK] Designations initialized.')

        # 4. Leave Types (1 SL/month, 1 CL/month = 12 each)
        LeaveType.objects.get_or_create(name='Sick Leave', defaults={'code': 'SL', 'days_allowed': 12})
        LeaveType.objects.get_or_create(name='Casual Leave', defaults={'code': 'CL', 'days_allowed': 12})
        self.stdout.write('  [OK] Leave Types initialized.')


        # 6. Core Administrator Accounts (2 CEOs, 1 HR)
        # Clean up obsolete default/placeholder accounts
        User.objects.filter(email__in=['ceo@company.com', 'operator@company.com', 'md.3capstech@gmail.com', 'hr@company.com']).delete()

        admin_accounts = [
            {
                'email': 'nani.reddy225@gmail.com',
                'username': 'nani_ceo',
                'first_name': 'Nani',
                'last_name': 'Reddy',
                'full_name': 'Nani Reddy',
                'role': Role.CEO,
                'is_staff': True,
                'is_superuser': True,
                'emp_id': 'EMP-CEO01',
                'department': hr_dept,
                'designation': ceo_desg,
                'salary': Decimal('250000.00'),
            },
            {
                'email': 'gowthamravindrareddy16@gmail.com',
                'username': 'gowtham_ceo',
                'first_name': 'Gowtham Ravindra',
                'last_name': 'Reddy',
                'full_name': 'Gowtham Ravindra Reddy',
                'role': Role.CEO,
                'is_staff': True,
                'is_superuser': True,
                'emp_id': 'EMP-CEO02',
                'department': hr_dept,
                'designation': ceo_desg,
                'salary': Decimal('250000.00'),
            },
            {
                'email': 'himaja47@gmail.com',
                'username': 'himaja_hr',
                'first_name': 'Himaja',
                'last_name': 'HR',
                'full_name': 'Himaja',
                'role': Role.HR,
                'is_staff': True,
                'is_superuser': False,
                'emp_id': 'EMP-HR01',
                'department': hr_dept,
                'designation': hr_mgr_desg,
                'salary': Decimal('120000.00'),
            },
        ]

        default_pwd = 'Mypswd@225'
        first_admin_user = None

        for acc in admin_accounts:
            user, _ = User.objects.get_or_create(
                email=acc['email'],
                defaults={
                    'username': acc['username'],
                    'first_name': acc['first_name'],
                    'last_name': acc['last_name'],
                    'role': acc['role'],
                    'is_staff': acc['is_staff'],
                    'is_superuser': acc['is_superuser'],
                    'is_active': True,
                }
            )
            user.role = acc['role']
            user.is_staff = acc['is_staff']
            user.is_superuser = acc['is_superuser']
            user.is_active = True
            user.first_name = acc['first_name']
            user.last_name = acc['last_name']
            user.set_password(default_pwd)
            user.save()

            if not first_admin_user:
                first_admin_user = user

            emp, _ = Employee.objects.get_or_create(
                user=user,
                defaults={
                    'employee_id': acc['emp_id'],
                    'full_name': acc['full_name'],
                    'email': acc['email'],
                    'department': acc['department'],
                    'designation': acc['designation'],
                    'joining_date': date.today(),
                    'work_mode': WorkMode.OFFICE,
                    'salary': acc['salary'],
                    'leave_balance': 24,
                }
            )
            emp.full_name = acc['full_name']
            emp.email = acc['email']
            emp.department = acc['department']
            emp.designation = acc['designation']
            emp.save()

        self.stdout.write('  [OK] Core Production Admin Accounts active (2 CEOs, 1 HR).')

        # 7. Initial System Audit Entry
        AuditService.log_action(
            actor=first_admin_user,
            action='SYSTEM_INITIALIZATION',
            reason='Clean organizational structure initialized for production environment',
        )

        self.stdout.write(self.style.SUCCESS('\n======================================================'))
        self.stdout.write(self.style.SUCCESS(' PRODUCTION INITIALIZATION COMPLETE! NO DUMMY DATA!'))
        self.stdout.write(self.style.SUCCESS('======================================================\n'))
