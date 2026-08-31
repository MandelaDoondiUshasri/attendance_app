from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from accounts.models import User, Role
from employees.models import Employee, Department, Designation, WorkMode, EmploymentStatus
from decimal import Decimal

class Command(BaseCommand):
    help = 'Setup CEO and HR production user accounts and employee profiles'

    def handle(self, *args, **options):
        # 1. Create or retrieve Departments
        exec_dept, _ = Department.objects.get_or_create(
            code='EXEC',
            defaults={
                'name': 'Executive Management',
                'description': 'Executive leadership and strategic decision making'
            }
        )
        hr_dept, _ = Department.objects.get_or_create(
            code='HR',
            defaults={
                'name': 'Human Resources',
                'description': 'Human Resources and People Operations'
            }
        )

        # 2. Create or retrieve Designations
        ceo_desg, _ = Designation.objects.get_or_create(
            title='Chief Executive Officer (CEO)',
            department=exec_dept,
            defaults={'description': 'Chief Executive Officer'}
        )
        hr_desg, _ = Designation.objects.get_or_create(
            title='HR Manager',
            department=hr_dept,
            defaults={'description': 'Human Resources Manager'}
        )

        accounts_to_setup = [
            {
                'email': 'nani.reddy225@gmail.com',
                'role': Role.CEO,
                'first_name': 'Nani',
                'last_name': 'Reddy',
                'full_name': 'Nani Reddy',
                'emp_id': 'EMP-CEO01',
                'department': exec_dept,
                'designation': ceo_desg,
                'is_staff': True,
                'is_superuser': True,
            },
            {
                'email': 'gowthamravindrareddy16@gmail.com',
                'role': Role.CEO,
                'first_name': 'Gowtham Ravindra',
                'last_name': 'Reddy',
                'full_name': 'Gowtham Ravindra Reddy',
                'emp_id': 'EMP-CEO02',
                'department': exec_dept,
                'designation': ceo_desg,
                'is_staff': True,
                'is_superuser': True,
            },
            {
                'email': 'himaja47@gmail.com',
                'role': Role.HR,
                'first_name': 'Himaja',
                'last_name': 'HR',
                'full_name': 'Himaja',
                'emp_id': 'EMP-HR01',
                'department': hr_dept,
                'designation': hr_desg,
                'is_staff': True,
                'is_superuser': False,
            }
        ]

        password = 'Mypswd@225'

        for acc in accounts_to_setup:
            email = acc['email'].strip().lower()
            with transaction.atomic():
                # Get or create User
                user = User.objects.filter(email__iexact=email).first()
                if not user:
                    username = email.split('@')[0]
                    # Ensure unique username
                    base_username = username
                    counter = 1
                    while User.objects.filter(username=username).exists():
                        username = f"{base_username}_{counter}"
                        counter += 1

                    user = User.objects.create(
                        email=email,
                        username=username,
                        first_name=acc['first_name'],
                        last_name=acc['last_name'],
                        role=acc['role'],
                        is_staff=acc['is_staff'],
                        is_superuser=acc['is_superuser'],
                        is_active=True
                    )
                    user_created = True
                else:
                    user.role = acc['role']
                    user.is_staff = acc['is_staff']
                    user.is_superuser = acc['is_superuser']
                    user.is_active = True
                    user.first_name = acc['first_name']
                    user.last_name = acc['last_name']
                    user_created = False

                user.set_password(password)
                user.save()

                # Get or create Employee profile
                emp = Employee.objects.filter(user=user).first()
                if not emp:
                    emp = Employee.objects.filter(email__iexact=email).first()
                
                if not emp:
                    # Check if employee_id is taken
                    emp_id = acc['emp_id']
                    if Employee.objects.filter(employee_id=emp_id).exists():
                        emp_id = f"{emp_id}-{user.id}"

                    emp = Employee.objects.create(
                        user=user,
                        employee_id=emp_id,
                        full_name=acc['full_name'],
                        email=email,
                        department=acc['department'],
                        designation=acc['designation'],
                        joining_date=timezone.now().date(),
                        work_mode=WorkMode.OFFICE,
                        employment_status=EmploymentStatus.ACTIVE,
                        salary=Decimal('150000.00') if acc['role'] == Role.CEO else Decimal('80000.00'),
                        leave_balance=24
                    )
                    emp_action = "Created Employee profile"
                else:
                    emp.user = user
                    emp.full_name = acc['full_name']
                    emp.department = acc['department']
                    emp.designation = acc['designation']
                    emp.employment_status = EmploymentStatus.ACTIVE
                    emp.save()
                    emp_action = "Updated Employee profile"

                status_str = "Created" if user_created else "Updated"
                self.stdout.write(self.style.SUCCESS(
                    f"[OK] {status_str} User '{email}' (Role: {acc['role']}, is_staff: {user.is_staff}, is_superuser: {user.is_superuser}) | {emp_action} ({emp.employee_id})"
                ))

        self.stdout.write(self.style.SUCCESS("\nAll 3 production accounts configured successfully with password 'Mypswd@225'."))
