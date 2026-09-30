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
                'code': 'MAINTENANCE',
                'description': 'Maintenance Department'
            }
        )
        if maint_dept.code != 'MAINTENANCE':
            maint_dept.code = 'MAINTENANCE'
            maint_dept.save()
        if created:
            self.stdout.write(self.style.SUCCESS(f"Created Department: {maint_dept.name} ({maint_dept.code})"))
        else:
            self.stdout.write(f"Department exists: {maint_dept.name} ({maint_dept.code})")

        # 2. Ensure Designations exist for Maintenance
        supervisor_desg, _ = Designation.objects.get_or_create(
            title='Supervisor',
            department=maint_dept,
            defaults={'description': 'Maintenance Supervisor'}
        )
        electrician_desg, _ = Designation.objects.get_or_create(
            title='Electrician',
            department=maint_dept,
            defaults={'description': 'Maintenance Electrician'}
        )
        plumber_desg, _ = Designation.objects.get_or_create(
            title='Plumber',
            department=maint_dept,
            defaults={'description': 'Maintenance Plumber'}
        )
        technician_desg, _ = Designation.objects.get_or_create(
            title='Technician',
            department=maint_dept,
            defaults={'description': 'Maintenance Technician'}
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
            supervisor_user.set_password('Password123!')
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

        # 4. Ensure sample maintenance workers from prompt exist
        sample_workers = [
            ('M001', 'Ravi Kumar', 'ravi.maint@frg.com', '9876543210', electrician_desg, 'Morning'),
            ('M002', 'Suresh', 'suresh.maint@frg.com', '9876543211', plumber_desg, 'Morning'),
            ('M003', 'Mahesh', 'mahesh.maint@frg.com', '9876543212', technician_desg, 'Morning'),
            ('M004', 'Ramesh', 'ramesh.maint@frg.com', '9876543213', worker_desg, 'Morning'),
            ('M005', 'Anand', 'anand.maint@frg.com', '9876543214', worker_desg, 'Morning'),
        ]
        for emp_id, name, email, phone, desg, shift_val in sample_workers:
            u, _ = User.objects.get_or_create(
                email=email,
                defaults={'username': email.split('@')[0], 'role': Role.EMPLOYEE, 'first_name': name.split()[0]}
            )
            u.set_password('Password123!')
            u.save()

            w, _ = Employee.objects.get_or_create(
                employee_id=emp_id,
                defaults={
                    'user': u,
                    'full_name': name,
                    'email': email,
                    'phone': phone,
                    'department': maint_dept,
                    'designation': desg,
                    'joining_date': date(2025, 1, 1),
                    'work_mode': WorkMode.OFFICE,
                    'employment_status': EmploymentStatus.ACTIVE,
                    'salary': Decimal('30000.00'),
                    'shift': shift_val,
                    'created_by': supervisor_user,
                    'manager': emp_profile,
                    'is_maintenance_worker': True,
                }
            )
            w.department = maint_dept
            w.designation = desg
            w.shift = shift_val
            w.created_by = supervisor_user
            w.manager = emp_profile
            w.is_maintenance_worker = True
            w.save()

        self.stdout.write(self.style.SUCCESS("Maintenance setup completed successfully."))
