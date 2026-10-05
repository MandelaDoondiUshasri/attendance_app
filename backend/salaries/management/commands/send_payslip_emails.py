import calendar
from datetime import datetime
from django.core.management.base import BaseCommand
from salaries.models import Payslip, PayslipStatus
from salaries.email_service import send_payslip_email, _get_portal_url


class Command(BaseCommand):
    help = 'Send official payslip release email alerts to employees with attached PDF payslips.'

    def add_arguments(self, parser):
        parser.add_argument('--year', type=int, help='Year of payslips (e.g. 2026)')
        parser.add_argument('--month', type=int, help='Month of payslips (1-12)')
        parser.add_argument('--employee-id', type=str, help='Target specific employee ID (e.g. EMP-0001)')
        parser.add_argument('--all', action='store_true', help='Send to ALL released payslips in database')
        parser.add_argument('--dry-run', action='store_true', help='Preview target recipients without sending emails')

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        all_flag = options.get('all', False)
        year = options.get('year')
        month = options.get('month')
        emp_id = options.get('employee_id')

        qs = Payslip.objects.filter(status=PayslipStatus.RELEASED).select_related('employee', 'employee__user', 'employee__department')

        if emp_id:
            qs = qs.filter(employee__employee_id=emp_id)

        if not all_flag:
            now = datetime.now()
            target_year = year or now.year
            qs = qs.filter(year=target_year)
            if month:
                qs = qs.filter(month=month)

        payslips = list(qs.order_by('year', 'month', 'employee__employee_id'))

        if not payslips:
            self.stdout.write(self.style.WARNING(
                "No RELEASED payslips found matching the specified criteria.\n"
                "Tip: Ensure payslips have status='RELEASED' before sending release alerts."
            ))
            return

        portal_url = _get_portal_url()
        self.stdout.write(self.style.SUCCESS(
            f"Found {len(payslips)} released payslips to notify."
        ))

        if dry_run:
            self.stdout.write(self.style.WARNING("--- DRY RUN MODE (no emails sent) ---"))
            for p in payslips:
                m_name = calendar.month_name[p.month]
                self.stdout.write(
                    f"Would send: {p.employee.full_name} <{p.employee.email}> | "
                    f"{m_name} {p.year} | Ref: {p.payslip_reference} | Net: ₹{p.net_salary:,.2f}"
                )
            return

        sent_count = 0
        fail_count = 0

        for p in payslips:
            m_name = calendar.month_name[p.month]
            emp_email = p.employee.email if p.employee else 'N/A'
            self.stdout.write(f"Sending to {p.employee.full_name} <{emp_email}> ({p.payslip_reference})... ", ending="")
            
            success = send_payslip_email(p, portal_url=portal_url)
            if success:
                sent_count += 1
                self.stdout.write(self.style.SUCCESS("OK"))
            else:
                fail_count += 1
                self.stdout.write(self.style.ERROR("FAILED"))

        self.stdout.write(self.style.SUCCESS(
            f"\nFinished dispatching payslip emails!\n"
            f"Successfully sent: {sent_count}\n"
            f"Failed / Skipped: {fail_count}"
        ))
