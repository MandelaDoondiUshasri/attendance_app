from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import date, timedelta, datetime
from decimal import Decimal
from accounts.models import User, Role
from employees.models import Employee, Department, Designation, WorkMode, EmploymentStatus
from biometrics.models import FaceProfile, BiometricDevice, DeviceType
from leaves.models import LeaveType, LeaveBalance, LeaveRequest, LeaveStatus
from wfh.models import WFHRequest, WFHStatus
from attendance.models import Attendance, AttendanceStatus, AttendanceWorkMode, AttendanceMethod, AttendanceCorrectionRequest, CorrectionStatus
from salaries.models import Salary, SalaryHistory, SalaryChangeType
from core.models import OrganizationSettings, Holiday
from notifications.models import Notification, NotificationType
from audit.services import AuditService

class Command(BaseCommand):
    help = 'Seeds initial development data for Enterprise HR Platform'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting database seeding...'))

        # 1. Organization Settings
        org_settings = OrganizationSettings.get_settings()
        org_settings.company_name = "Apex Enterprise Corp"
        org_settings.office_start_time = "09:00"
        org_settings.office_end_time = "18:00"
        org_settings.grace_period_minutes = 15
        org_settings.required_working_hours = Decimal('8.00')
        org_settings.save()
        self.stdout.write('  [OK] Organization Settings created.')

        # 2. Departments
        eng_dept, _ = Department.objects.get_or_create(name='Engineering', code='ENG', description='Software Engineering and Architecture')
        hr_dept, _ = Department.objects.get_or_create(name='Human Resources', code='HR', description='HR Operations and Administration')
        sales_dept, _ = Department.objects.get_or_create(name='Sales & Marketing', code='SALES', description='Global Sales and Growth')
        fin_dept, _ = Department.objects.get_or_create(name='Finance', code='FIN', description='Accounting and Financial Management')
        self.stdout.write('  [OK] Departments created.')

        # 3. Designations
        ceo_desg, _ = Designation.objects.get_or_create(title='Chief Executive Officer', department=hr_dept)
        hr_mgr_desg, _ = Designation.objects.get_or_create(title='HR Manager', department=hr_dept)
        op_desg, _ = Designation.objects.get_or_create(title='Attendance Operator', department=hr_dept)
        arch_desg, _ = Designation.objects.get_or_create(title='Senior Software Architect', department=eng_dept)
        dev_desg, _ = Designation.objects.get_or_create(title='Frontend Engineer', department=eng_dept)
        sales_desg, _ = Designation.objects.get_or_create(title='Sales Director', department=sales_dept)
        self.stdout.write('  [OK] Designations created.')

        # 4. Leave Types
        paid_leave, _ = LeaveType.objects.get_or_create(name='Paid Leave', code='PL', days_allowed=12)
        casual_leave, _ = LeaveType.objects.get_or_create(name='Casual Leave', code='CL', days_allowed=8)
        sick_leave, _ = LeaveType.objects.get_or_create(name='Sick Leave', code='SL', days_allowed=6)
        self.stdout.write('  [OK] Leave Types created.')


        # 5. Create Accounts & Employees
        # CEO User
        ceo_user, _ = User.objects.get_or_create(
            email='ceo@company.com',
            defaults={
                'username': 'ceo',
                'first_name': 'Alexander',
                'last_name': 'Vance',
                'role': Role.CEO,
                'is_staff': True,
                'is_superuser': True
            }
        )
        ceo_user.set_password('Password123!')
        ceo_user.save()

        ceo_emp, _ = Employee.objects.get_or_create(
            employee_id='EMP-1000',
            defaults={
                'user': ceo_user,
                'full_name': 'Alexander Vance',
                'email': 'ceo@company.com',
                'phone': '+1 (555) 010-0000',
                'department': hr_dept,
                'designation': ceo_desg,
                'joining_date': date(2022, 1, 1),
                'work_mode': WorkMode.OFFICE,
                'salary': Decimal('250000.00'),
                'leave_balance': 30,
                'biometric_id': 'FP-1000',
                'face_profile_enrolled': True
            }
        )

        # HR Admin User
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

        hr_emp, _ = Employee.objects.get_or_create(
            employee_id='EMP-1001',
            defaults={
                'user': hr_user,
                'full_name': 'Sarah Jenkins',
                'email': 'hr@company.com',
                'phone': '+1 (555) 010-0001',
                'department': hr_dept,
                'designation': hr_mgr_desg,
                'joining_date': date(2023, 2, 15),
                'work_mode': WorkMode.OFFICE,
                'salary': Decimal('120000.00'),
                'leave_balance': 24,
                'biometric_id': 'FP-1001',
                'face_profile_enrolled': True
            }
        )

        # Attendance Operator User
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

        op_emp, _ = Employee.objects.get_or_create(
            employee_id='EMP-1002',
            defaults={
                'user': op_user,
                'full_name': 'Marcus Brody',
                'email': 'operator@company.com',
                'phone': '+1 (555) 010-0002',
                'department': hr_dept,
                'designation': op_desg,
                'joining_date': date(2023, 5, 10),
                'work_mode': WorkMode.OFFICE,
                'salary': Decimal('60000.00'),
                'leave_balance': 20,
                'biometric_id': 'FP-1002',
                'face_profile_enrolled': True
            }
        )

        # Employee 1 (Software Architect)
        emp1_user, _ = User.objects.get_or_create(
            email='emp1@company.com',
            defaults={
                'username': 'david_miller',
                'first_name': 'David',
                'last_name': 'Miller',
                'role': Role.EMPLOYEE
            }
        )
        emp1_user.set_password('Password123!')
        emp1_user.save()

        emp1, _ = Employee.objects.get_or_create(
            employee_id='EMP-1003',
            defaults={
                'user': emp1_user,
                'full_name': 'David Miller',
                'email': 'emp1@company.com',
                'phone': '+1 (555) 010-0003',
                'department': eng_dept,
                'designation': arch_desg,
                'joining_date': date(2023, 6, 1),
                'work_mode': WorkMode.OFFICE,
                'salary': Decimal('140000.00'),
                'leave_balance': 22,
                'biometric_id': 'FP-1003',
                'face_profile_enrolled': True
            }
        )

        # Employee 2 (WFH Frontend Developer)
        emp2_user, _ = User.objects.get_or_create(
            email='emp2@company.com',
            defaults={
                'username': 'elena_rodriguez',
                'first_name': 'Elena',
                'last_name': 'Rodriguez',
                'role': Role.EMPLOYEE
            }
        )
        emp2_user.set_password('Password123!')
        emp2_user.save()

        emp2, _ = Employee.objects.get_or_create(
            employee_id='EMP-1004',
            defaults={
                'user': emp2_user,
                'full_name': 'Elena Rodriguez',
                'email': 'emp2@company.com',
                'phone': '+1 (555) 010-0004',
                'department': eng_dept,
                'designation': dev_desg,
                'joining_date': date(2024, 1, 10),
                'work_mode': WorkMode.WFH,
                'salary': Decimal('95000.00'),
                'leave_balance': 24,
                'biometric_id': 'FP-1004',
                'face_profile_enrolled': True
            }
        )
        self.stdout.write('  [OK] Sample Users & Employees created.')

        # 6. Biometric Devices
        BiometricDevice.objects.get_or_create(
            device_id='DEV-FACE-01',
            defaults={'name': 'Main Gate Face Recognition Terminal', 'device_type': DeviceType.FACE, 'location_name': 'Lobby Entrance', 'is_online': True}
        )
        BiometricDevice.objects.get_or_create(
            device_id='DEV-FP-01',
            defaults={'name': 'HQ Fingerprint Scanner Alpha', 'device_type': DeviceType.FINGERPRINT, 'location_name': 'Turnstile Gate 1', 'is_online': True}
        )

        # 7. Salary History
        Salary.objects.get_or_create(employee=emp1, defaults={'current_salary': Decimal('140000.00')})
        SalaryHistory.objects.get_or_create(
            employee=emp1,
            previous_salary=Decimal('125000.00'),
            defaults={
                'change_type': SalaryChangeType.INCREMENT,
                'amount': Decimal('15000.00'),
                'percentage': Decimal('12.00'),
                'new_salary': Decimal('140000.00'),
                'reason': 'Annual Performance Merit Increase',
                'effective_date': date(2025, 1, 1),
                'changed_by': ceo_user
            }
        )

        # 8. Sample WFH Request & Approval
        today = date.today()
        wfh_req, _ = WFHRequest.objects.get_or_create(
            employee=emp2,
            date=today,
            defaults={
                'reason': 'Scheduled client architecture reviews remotely',
                'status': WFHStatus.APPROVED,
                'reviewed_by': ceo_user
            }
        )

        # 9. Attendance Seeding (Past 5 days)
        for i in range(5, -1, -1):
            past_date = today - timedelta(days=i)
            # Emp 1 Office Check-in
            check_in_time = timezone.make_aware(datetime.combine(past_date, datetime.strptime("08:55", "%H:%M").time()))
            check_out_time = timezone.make_aware(datetime.combine(past_date, datetime.strptime("18:05", "%H:%M").time()))
            Attendance.objects.get_or_create(
                employee=emp1,
                date=past_date,
                defaults={
                    'check_in': check_in_time,
                    'check_out': check_out_time,
                    'working_hours': Decimal('9.16'),
                    'status': AttendanceStatus.PRESENT,
                    'work_mode': AttendanceWorkMode.OFFICE,
                    'attendance_method': AttendanceMethod.FACE,
                    'face_verified': True,
                    'liveness_verified': True,
                    'taken_by': op_user
                }
            )

        # 10. Sample Leave Request
        LeaveRequest.objects.get_or_create(
            employee=emp1,
            start_date=today + timedelta(days=5),
            defaults={
                'leave_type': paid_leave,
                'end_date': today + timedelta(days=7),
                'number_of_days': 3,
                'reason': 'Family Vacation',
                'status': LeaveStatus.PENDING
            }
        )

        # 11. Initial Audit Log
        AuditService.log_action(
            actor=ceo_user,
            action='SYSTEM_INITIALIZATION',
            reason='Database seeded with production sample dataset',
        )

        self.stdout.write(self.style.SUCCESS('\n======================================================'))
        self.stdout.write(self.style.SUCCESS(' DATABASE SEEDED SUCCESSFULLY! SYSTEM READY!'))
        self.stdout.write(self.style.SUCCESS('======================================================'))
        self.stdout.write(' Default Login Credentials:')
        self.stdout.write('  - CEO:                 ceo@company.com        / Password123!')
        self.stdout.write('  - HR Admin:            hr@company.com         / Password123!')
        self.stdout.write('  - Attendance Operator: operator@company.com   / Password123!')
        self.stdout.write('  - Employee (Office):   emp1@company.com       / Password123!')
        self.stdout.write('  - Employee (WFH):      emp2@company.com       / Password123!')
        self.stdout.write('======================================================\n')

