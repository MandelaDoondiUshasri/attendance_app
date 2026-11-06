import os
from datetime import date, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction

from tenants.models import (
    Company, SubscriptionPlan, CompanySubscription,
    CompanySetting, PlanTier, CompanyStatus, SubscriptionStatus
)
from employees.models import Department, Designation, Employee, EmploymentStatus
from accounts.models import Role

User = get_user_model()


class Command(BaseCommand):
    help = 'Idempotently provisions a new customer organization with CEO and HR accounts.'

    def add_arguments(self, parser):
        parser.add_argument('--name', type=str, default='FIRST CARE PHARMACY', help='Company display name')
        parser.add_argument('--slug', type=str, default='first-care-pharmacy', help='URL and tenant slug')
        parser.add_argument('--contact-email', type=str, default='admin@firstcarepharmacy.com', help='Company contact email')
        parser.add_argument('--plan-tier', type=str, default=PlanTier.ENTERPRISE, choices=[t.value for t in PlanTier], help='Subscription plan tier')
        parser.add_argument('--ceo-email', type=str, default='ceo@firstcarepharmacy.com', help='CEO login email')
        parser.add_argument('--ceo-password', type=str, default='FirstCareCEO@2026!', help='CEO login password')
        parser.add_argument('--ceo-name', type=str, default='First Care CEO', help='CEO full name')
        parser.add_argument('--hr-email', type=str, default='hr@firstcarepharmacy.com', help='HR login email')
        parser.add_argument('--hr-password', type=str, default='FirstCareHR@2026!', help='HR login password')
        parser.add_argument('--hr-name', type=str, default='First Care HR', help='HR full name')

    def handle(self, *args, **options):
        name = options['name'].strip()
        slug = options['slug'].strip().lower()
        contact_email = options['contact_email'].strip().lower()
        tier = options['plan_tier']
        ceo_email = options['ceo_email'].strip().lower()
        ceo_password = options['ceo_password']
        ceo_name = options['ceo_name'].strip()
        hr_email = options['hr_email'].strip().lower()
        hr_password = options['hr_password']
        hr_name = options['hr_name'].strip()

        with transaction.atomic():
            # 1. Company
            company, created = Company.objects.get_or_create(
                slug=slug,
                defaults={
                    'name': name,
                    'contact_email': contact_email,
                    'contact_phone': '+91 9876543210',
                    'status': CompanyStatus.ACTIVE,
                    'is_master_tenant': False
                }
            )
            if not created:
                company.name = name
                company.status = CompanyStatus.ACTIVE
                company.save()
                self.stdout.write(self.style.WARNING(f"Company '{name}' ({slug}) already exists; updated status to ACTIVE."))
            else:
                self.stdout.write(self.style.SUCCESS(f"Created company: '{name}' (ID: {company.id}, Slug: {slug})"))

            # 2. Subscription Plan & Active Subscription
            plan = SubscriptionPlan.objects.filter(tier=tier).first()
            if not plan:
                plan = SubscriptionPlan.objects.create(
                    name=f"{tier.title()} SaaS Plan",
                    tier=tier,
                    billing_cycle="YEARLY",
                    price_inr=49999.00 if tier == PlanTier.ENTERPRISE else 19999.00,
                    max_employees=250 if tier == PlanTier.ENTERPRISE else 50,
                    max_storage_mb=50000,
                    is_active=True
                )

            sub, _ = CompanySubscription.objects.get_or_create(
                company=company,
                defaults={
                    'plan': plan,
                    'status': SubscriptionStatus.ACTIVE,
                    'start_date': date.today(),
                    'expiry_date': date.today() + timedelta(days=365),
                    'grace_period_days': 15
                }
            )
            sub.plan = plan
            sub.status = SubscriptionStatus.ACTIVE
            if sub.expiry_date < date.today():
                sub.expiry_date = date.today() + timedelta(days=365)
            sub.save()

            # 3. Company Settings
            CompanySetting.objects.get_or_create(
                company=company,
                defaults={
                    'company_tagline': f'{name} Workspace Portal',
                    'brand_color': '#059669',
                    'office_start_time': '09:00',
                    'office_end_time': '18:00',
                    'grace_period_minutes': 15,
                    'required_working_hours': Decimal('8.00'),
                    'half_day_threshold_hours': Decimal('4.00')
                }
            )

            # 4. Departments (Unique per company with company prefix)
            adm_name = f"{name} Administration"[:100]
            adm_code = f"{slug[:4].upper()}-ADM"[:20]
            dept_admin = Department.objects.filter(company=company, code=adm_code).first()
            if not dept_admin:
                dept_admin = Department.objects.filter(name=adm_name).first()
            if not dept_admin:
                dept_admin = Department.objects.create(
                    company=company,
                    name=adm_name,
                    code=adm_code
                )

            ops_name = f"{name} Pharmacy Operations"[:100]
            ops_code = f"{slug[:4].upper()}-OPS"[:20]
            dept_ops = Department.objects.filter(company=company, code=ops_code).first()
            if not dept_ops:
                dept_ops = Department.objects.filter(name=ops_name).first()
            if not dept_ops:
                dept_ops = Department.objects.create(
                    company=company,
                    name=ops_name,
                    code=ops_code
                )

            # 5. Designations
            desig_ceo, _ = Designation.objects.get_or_create(
                company=company,
                department=dept_admin,
                title='Chief Executive Officer'
            )
            desig_hr, _ = Designation.objects.get_or_create(
                company=company,
                department=dept_admin,
                title='HR Manager'
            )

            # 6. CEO User & Profile
            ceo_user = User.objects.filter(email=ceo_email).first()
            if not ceo_user:
                ceo_user = User.objects.create_user(
                    email=ceo_email,
                    username=f"ceo_{slug.replace('-', '_')}",
                    password=ceo_password,
                    first_name=ceo_name.split()[0] if ceo_name else "CEO",
                    last_name=" ".join(ceo_name.split()[1:]) if len(ceo_name.split()) > 1 else "",
                    role=Role.CEO,
                    company=company
                )
                self.stdout.write(self.style.SUCCESS(f"Created CEO User: {ceo_email}"))
            else:
                ceo_user.company = company
                ceo_user.role = Role.CEO
                ceo_user.set_password(ceo_password)
                ceo_user.is_active = True
                ceo_user.save()
                self.stdout.write(self.style.WARNING(f"Updated CEO User: {ceo_email}"))

            Employee.objects.get_or_create(
                user=ceo_user,
                defaults={
                    'company': company,
                    'employee_id': f"{slug[:3].upper()}-001",
                    'full_name': ceo_name,
                    'email': ceo_email,
                    'department': dept_admin,
                    'designation': desig_ceo,
                    'employment_status': EmploymentStatus.ACTIVE,
                    'joining_date': date.today(),
                    'salary': Decimal('150000.00')
                }
            )

            # 7. HR User & Profile
            hr_user = User.objects.filter(email=hr_email).first()
            if not hr_user:
                hr_user = User.objects.create_user(
                    email=hr_email,
                    username=f"hr_{slug.replace('-', '_')}",
                    password=hr_password,
                    first_name=hr_name.split()[0] if hr_name else "HR",
                    last_name=" ".join(hr_name.split()[1:]) if len(hr_name.split()) > 1 else "",
                    role=Role.HR,
                    company=company
                )
                self.stdout.write(self.style.SUCCESS(f"Created HR User: {hr_email}"))
            else:
                hr_user.company = company
                hr_user.role = Role.HR
                hr_user.set_password(hr_password)
                hr_user.is_active = True
                hr_user.save()
                self.stdout.write(self.style.WARNING(f"Updated HR User: {hr_email}"))

            Employee.objects.get_or_create(
                user=hr_user,
                defaults={
                    'company': company,
                    'employee_id': f"{slug[:3].upper()}-002",
                    'full_name': hr_name,
                    'email': hr_email,
                    'department': dept_admin,
                    'designation': desig_hr,
                    'employment_status': EmploymentStatus.ACTIVE,
                    'joining_date': date.today(),
                    'salary': Decimal('60000.00')
                }
            )

        self.stdout.write(self.style.SUCCESS("\n" + "=" * 60))
        self.stdout.write(self.style.SUCCESS(f"COMPANY ONBOARDED: {name}"))
        self.stdout.write(self.style.SUCCESS(f"Slug: {slug} | Tier: {tier} | ID: {company.id}"))
        self.stdout.write(self.style.SUCCESS("-" * 60))
        self.stdout.write(self.style.SUCCESS(f"CEO Email    : {ceo_email}"))
        self.stdout.write(self.style.SUCCESS(f"CEO Password : {ceo_password}"))
        self.stdout.write(self.style.SUCCESS("-" * 60))
        self.stdout.write(self.style.SUCCESS(f"HR Email     : {hr_email}"))
        self.stdout.write(self.style.SUCCESS(f"HR Password  : {hr_password}"))
        self.stdout.write(self.style.SUCCESS("=" * 60 + "\n"))
