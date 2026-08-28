from django.core.management.base import BaseCommand
from accounts.models import User, Role
from employees.models import Employee, Department, Designation, WorkMode
from decimal import Decimal
from datetime import date

class Command(BaseCommand):
    help = 'Create or update a production user with a specific enterprise role'

    def add_arguments(self, parser):
        parser.add_argument('--email', type=str, required=True, help='Email address of the user')
        parser.add_argument('--role', type=str, required=True, choices=['CEO', 'HR', 'EMPLOYEE'], help='Role to assign')
        parser.add_argument('--password', type=str, required=True, help='Password for the user')
        parser.add_argument('--first_name', type=str, default='', help='First name')
        parser.add_argument('--last_name', type=str, default='', help='Last name')
        parser.add_argument('--emp_id', type=str, default='', help='Employee ID (e.g. EMP-2001)')

    def handle(self, *args, **options):
        email = options['email'].strip().lower()
        role_choice = options['role'].upper()
        password = options['password']
        first_name = options.get('first_name') or email.split('@')[0].capitalize()
        last_name = options.get('last_name') or 'User'
        emp_id = options.get('emp_id') or f"EMP-{email.split('@')[0].upper()[:6]}"

        is_staff = role_choice in [Role.CEO, Role.HR]
        is_superuser = role_choice == Role.CEO

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': email.split('@')[0],
                'first_name': first_name,
                'last_name': last_name,
                'role': role_choice,
                'is_staff': is_staff,
                'is_superuser': is_superuser,
            }
        )

        user.set_password(password)
        user.role = role_choice
        user.is_staff = is_staff
        user.is_superuser = is_superuser
        user.first_name = first_name
        user.last_name = last_name
        user.save()

        # Ensure default Department and Designation exist
        dept_name = 'Human Resources' if role_choice in [Role.CEO, Role.HR] else 'Engineering'
        dept_code = 'HR' if role_choice in [Role.CEO, Role.HR] else 'ENG'
        dept, _ = Department.objects.get_or_create(name=dept_name, defaults={'code': dept_code})

        desg_title = 'Executive' if role_choice == Role.CEO else 'HR Specialist' if role_choice == Role.HR else 'Software Engineer'
        desg, _ = Designation.objects.get_or_create(title=desg_title, defaults={'department': dept})

        emp, emp_created = Employee.objects.get_or_create(
            user=user,
            defaults={
                'employee_id': emp_id,
                'full_name': f"{first_name} {last_name}".strip(),
                'email': email,
                'department': dept,
                'designation': desg,
                'joining_date': date.today(),
                'work_mode': WorkMode.OFFICE,
                'salary': Decimal('100000.00'),
                'leave_balance': 24
            }
        )

        action_word = "Created" if created else "Updated"
        self.stdout.write(self.style.SUCCESS(
            f"Successfully {action_word} user '{email}' with Role: {role_choice} (Employee ID: {emp.employee_id})"
        ))
