import os
import shutil
from pathlib import Path
from django.conf import settings
from django.core.management.base import BaseCommand
from core.models import OrganizationSettings
from tenants.models import Company, CompanySetting


class Command(BaseCommand):
    help = 'Brands the attendance application as ATTENDX with the official logo and suite defaults.'

    def handle(self, *args, **options):
        # 1. Ensure logo exists in MEDIA_ROOT/branding
        media_branding_dir = Path(settings.MEDIA_ROOT) / 'branding'
        media_branding_dir.mkdir(parents=True, exist_ok=True)
        dest_logo = media_branding_dir / 'attendx-logo.png'

        static_logo = Path(__file__).resolve().parent.parent.parent / 'static' / 'branding' / 'attendx-logo.png'
        if static_logo.exists():
            shutil.copyfile(static_logo, dest_logo)
            self.stdout.write(self.style.SUCCESS(f"Copied {static_logo} -> {dest_logo}"))

        # 2. Update Core Organization Settings
        org = OrganizationSettings.get_settings()
        org.company_name = "ATTENDX"
        org.company_tagline = "Enterprise Attendance & Workforce Suite"
        org.contact_email = "support@attendx.com"
        org.company_logo = "branding/attendx-logo.png"
        org.save()
        self.stdout.write(self.style.SUCCESS("Updated OrganizationSettings to 'ATTENDX' with logo 'branding/attendx-logo.png'"))

        # 3. Update Master Tenant Company if present
        master = Company.objects.filter(is_master_tenant=True).first()
        if master:
            master.name = "ATTENDX"
            master.contact_email = "support@attendx.com"
            master.save(update_fields=['name', 'contact_email'])
            setting, _ = CompanySetting.objects.get_or_create(company=master)
            setting.company_tagline = "Enterprise Attendance & Workforce Suite"
            setting.company_logo = "branding/attendx-logo.png"
            setting.save()
            self.stdout.write(self.style.SUCCESS(f"Updated Master Tenant '{master.id}' to 'ATTENDX'"))

        # 4. Invalidate cached payslip PDFs
        try:
            from salaries.models import Payslip
            Payslip.objects.all().update(pdf_file=None)
            self.stdout.write(self.style.SUCCESS("Invalidated cached payslips."))
        except Exception:
            pass

        self.stdout.write(self.style.SUCCESS("ATTENDX branding successfully applied!"))
