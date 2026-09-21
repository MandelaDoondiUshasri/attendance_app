from django.core.management.base import BaseCommand
from employees.models import Department, Designation, Employee, EmploymentStatus, WorkMode
from accounts.models import User, Role
from datetime import date
from decimal import Decimal

class Command(BaseCommand):
    help = 'Ensures the Maintenance department and Supervisor user exist.'

    def handle(self, *args, **options):
        # 1. Ensure Maintenance Department exists
        maint_dept, created = Department.objects.get_or_create(
            name='Maintenance',
            defaults={
                'code': 'MAINT',
                'description': 'Maintenance Department'
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Created Department: {maint_dept.name} ({maint_dept.code})"))
        else:
            self.stdout.write(f"Department already exists: {maint_dept.name} ({maint_dept.code})")

        # 2. Ensure Supervisor Designation exists for Maintenance
        supervisor_desg, _ = Designation.objects.get_or_create(
            title='Supervisor',
            department=maint_dept,
            defaults={'description': 'Maintenance Supervisor'}
        )

        worker_desg, _ = Designation.objects.get_or_create(
            title='Maintenance Worker',
            department=maint_dept,
            defaults={'description': 'Maintenance Worker'}
        )

        # 3. Ensure a Maintenance Supervisor account exists
        supervisor_email = 'supervisor.maintenance@frg.com'
        supervisor_user = User.objects.filter(email=supervisor_email).first()
        if not supervisor_user:
            supervisor_user = User.objects.create_user(
                email=supervisor_email,
                username='maint_supervisor',
                password='Password123!',
                role=Role.SUPERVISOR,
                first_name='Maintenance',
                last_name='Supervisor'
            )
            self.stdout.write(self.style.SUCCESS(f"Created Supervisor User: {supervisor_email}"))
        else:
            supervisor_user.role = Role.SUPERVISOR
            supervisor_user.save()

        # Ensure employee profile for supervisor
        emp_profile = Employee.objects.filter(user=supervisor_user).first()
        if not emp_profile:
            emp_profile = Employee.objects.create(
                user=supervisor_user,
                employee_id='SUP-MAINT-001',
                full_name='Maintenance Supervisor',
                email=supervisor_email,
                phone='+1234567890',
                department=maint_dept,
                designation=supervisor_desg,
                joining_date=date(2025, 1, 1),
                work_mode=WorkMode.OFFICE,
                employment_status=EmploymentStatus.ACTIVE,
                salary=Decimal('75000.00'),
                leave_balance=24.0
            )
            self.stdout.write(self.style.SUCCESS("Created Employee Profile for Maintenance Supervisor"))
        else:
            emp_profile.department = maint_dept
            emp_profile.designation = supervisor_desg
            emp_profile.save()

        self.stdout.write(self.style.SUCCESS("Maintenance setup completed successfully."))
