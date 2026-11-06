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
                user = User(
                    email=email,
                    username=email.split('@')[0],
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

            # 2. Entitlement Configuration:
            # - Fortune Rise Groups (Master Tenant) -> Maintenance Ops ENABLED
            # - First Care Pharmacy -> Maintenance Ops DISABLED
            # - All other tenants remain decided by AttendX Super Admin
            frg_tenant = Company.objects.filter(slug='frg').first() or Company.objects.filter(is_master_tenant=True).first()
            if frg_tenant:
                frg_tenant.has_maintenance_module = True
                frg_tenant.save(update_fields=['has_maintenance_module'])

            fcp_tenant = Company.objects.filter(slug='first-care-pharmacy').first()
            if fcp_tenant:
                fcp_tenant.has_maintenance_module = False
                fcp_tenant.save(update_fields=['has_maintenance_module'])

        self.stdout.write(self.style.SUCCESS("=" * 65))
        self.stdout.write(self.style.SUCCESS("ATTENDX PLATFORM SUPER ADMIN PROVISIONED"))
        self.stdout.write(self.style.SUCCESS("=" * 65))
        self.stdout.write(f"Status      : {created_msg}")
        self.stdout.write(f"Email       : {email}")
        self.stdout.write(f"Password    : {password}")
        self.stdout.write(f"Role        : {Role.SUPER_ADMIN} (Global SaaS Platform Owner)")
        self.stdout.write(f"Company     : None (Platform-Wide Scope)")
        self.stdout.write("-" * 65)
        self.stdout.write("TENANT MODULE ENTITLEMENTS:")
        if frg_tenant:
            self.stdout.write(f" - {frg_tenant.name} [{frg_tenant.slug}]: Maintenance Ops = ENABLED")
        if fcp_tenant:
            self.stdout.write(f" - {fcp_tenant.name} [{fcp_tenant.slug}]: Maintenance Ops = DISABLED")
        self.stdout.write("=" * 65)

