from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth import get_user_model
from accounts.models import Role
from tenants.models import Company

User = get_user_model()


class Command(BaseCommand):
    help = "Creates or updates the primary SaaS AttendX Platform Super Admin and configures tenant module entitlements."

    def add_arguments(self, parser):
        parser.add_argument(
            '--email',
            type=str,
            default='superadmin@attendx.com',
            help='Super Admin email address (default: superadmin@attendx.com)'
        )
        parser.add_argument(
            '--password',
            type=str,
            default='AttendXSuperAdmin@2026!',
            help='Super Admin password (default: AttendXSuperAdmin@2026!)'
        )
        parser.add_argument(
            '--first-name',
            type=str,
            default='AttendX',
            help='Super Admin first name'
        )
        parser.add_argument(
            '--last-name',
            type=str,
            default='Super Admin',
            help='Super Admin last name'
        )

    def handle(self, *args, **options):
        email = options['email'].strip().lower()
        password = options['password']
        first_name = options['first_name']
        last_name = options['last_name']

        with transaction.atomic():
            # 1. Create or update the global AttendX Super Admin user
            user = User.objects.filter(email__iexact=email).first()
            if not user:
                username = 'attendx_superadmin' if email == 'superadmin@attendx.com' else email.split('@')[0]
                if User.objects.filter(username=username).exists():
                    username = f"{username}_{User.objects.count() + 1}"
                user = User(
                    email=email,
                    username=username,
                    first_name=first_name,
                    last_name=last_name,
                    role=Role.SUPER_ADMIN,
                    company=None,
                    is_staff=True,
                    is_superuser=True,
                    is_active=True
                )
                user.set_password(password)
                user.save()
                created_msg = f"Created AttendX Super Admin: {email}"
            else:
                user.role = Role.SUPER_ADMIN
                user.company = None
                user.is_staff = True
                user.is_superuser = True
                user.is_active = True
                user.first_name = first_name
                user.last_name = last_name
                user.set_password(password)
                user.save()
                created_msg = f"Updated AttendX Super Admin: {email}"

            # 2. Module Entitlements:
            # - Master Tenant (FRG) maintains access to Maintenance Ops
            frg = Company.objects.filter(slug='frg').first() or Company.objects.filter(is_master_tenant=True).first()
            if frg:
                frg.has_maintenance_module = True
                frg.save(update_fields=['has_maintenance_module'])

            # - First Care Pharmacy does NOT have Maintenance Ops
            fcp = Company.objects.filter(slug='first-care-pharmacy').first()
            if fcp:
                fcp.has_maintenance_module = False
                fcp.save(update_fields=['has_maintenance_module'])

        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.stdout.write(self.style.SUCCESS("ATTENDX PLATFORM SUPER ADMIN INITIALIZATION"))
        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.stdout.write(self.style.SUCCESS(created_msg))
        self.stdout.write(self.style.SUCCESS(f"Email    : {email}"))
        self.stdout.write(self.style.SUCCESS(f"Password : {password}"))
        self.stdout.write(self.style.SUCCESS(f"Role     : SUPER_ADMIN"))
        self.stdout.write(self.style.SUCCESS(f"Company  : None (Global SaaS Platform)"))
        self.stdout.write(self.style.SUCCESS("-" * 60))
        self.stdout.write(self.style.SUCCESS("Module Entitlements:"))
        if frg:
            self.stdout.write(self.style.SUCCESS(f"  [x] {frg.name}: Maintenance Ops = ENABLED"))
        if fcp:
            self.stdout.write(self.style.SUCCESS(f"  [ ] {fcp.name}: Maintenance Ops = DISABLED"))
        self.stdout.write(self.style.SUCCESS("=" * 60))
