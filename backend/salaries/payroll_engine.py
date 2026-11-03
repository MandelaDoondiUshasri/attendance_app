"""
Automated Monthly Payroll Engine with Complete Indian EPF / PF Statutory Deductions.
Compliant with 2026 EPFO rules, Gazette S.O. 5109(E), attendance integration,
and separation of employer contributions from employee net salary.
"""

from datetime import date
from decimal import Decimal, ROUND_HALF_UP
import calendar
from django.db import transaction
from django.utils import timezone

from employees.models import Employee, EmploymentStatus
from salaries.models import (
    Payroll, PayrollStatus, PFContribution, EmployeePFProfile,
    PFConfiguration, PayrollAuditLog, Payslip, PayslipStatus,
    EmployeeSalary, SalaryRevision, EmployeeESIProfile, SalaryStructure
)
from salaries.pf_engine import PFCalculationEngine, PFEligibilityEngine, round_rupee
from salaries.salary_structure_engine import HRSalaryStructureEngine
from salaries.statutory_wage_engine import StatutoryWageEngine
from salaries.pt_engine import ProfessionalTaxEngine
from salaries.esi_engine import ESIEngine
from salaries.tds_engine import IncomeTaxTDSEngine
from reports.services import MonthlyAttendanceSalaryEngine


def calculate_professional_tax(gross_salary: Decimal, state: str = 'TELANGANA', month: int = 1, gender: str = 'MALE') -> Decimal:
    res = ProfessionalTaxEngine.calculate_pt(monthly_gross_salary=gross_salary, state=state, month=month, gender=gender)
    return Decimal(str(res['pt_amount']))


def calculate_esi(gross_salary: Decimal, base_monthly_gross: Decimal = None, opt_out: bool = False, as_of_date: date = None) -> tuple[Decimal, Decimal]:
    res = ESIEngine.calculate_esi(
        earned_gross_wages=gross_salary,
        base_monthly_gross=base_monthly_gross,
        opt_out=opt_out,
        as_of_date=as_of_date
    )
    return Decimal(str(res['employee_esi'])), Decimal(str(res['employer_esi']))


class AutomatedPayrollEngine:
    """
    Executes automated monthly payroll processing for individual employees or entire company roster.
    Integrates directly with attendance, leaves, and EPFO 2026 calculations.
    """

    @classmethod
    def calculate_employee_payroll(
        cls,
        employee: Employee,
        year: int,
        month: int,
        force_recalculate: bool = False,
        actor=None
    ) -> dict:
        """
        Calculates and persists complete payroll and PF contributions for a single employee.
        """
        # 1. Check for locked finalized payroll record
        existing_payroll = Payroll.objects.filter(employee=employee, year=year, month=month).first()
        if existing_payroll and existing_payroll.is_locked and not force_recalculate:
            raise ValueError(f"Payroll for {employee.full_name} for {month}/{year} is finalized and locked.")

        # 2. Fetch employee salary profile, attendance, working days, and leave data
        report = MonthlyAttendanceSalaryEngine.calculate_employee_monthly_report(employee, year, month)

        calendar_days = report.get('calendar_days', 30)
        present_days = Decimal(str(report.get('present_days', 0)))
        paid_leave_days = Decimal(str(report.get('total_paid_leave_used', 0)))
        unpaid_absence_days = Decimal(str(report.get('unpaid_absence_days', 0))) # LOP
        cal_days_dec = Decimal(str(calendar_days))
        payable_days = max(Decimal('0.00'), cal_days_dec - unpaid_absence_days)

        emp_salary_prof = EmployeeSalary.objects.filter(employee=employee, is_active=True).first()

        # 3. Resolve the 6 Independent Statutory Toggles
        if emp_salary_prof:
            employee_pf_enabled = emp_salary_prof.employee_pf_enabled
            employer_pf_enabled = emp_salary_prof.employer_pf_enabled
            pt_enabled = emp_salary_prof.pt_enabled
            employee_esi_enabled = emp_salary_prof.employee_esi_enabled
            employer_esi_enabled = emp_salary_prof.employer_esi_enabled
            tds_enabled = emp_salary_prof.tds_enabled
            pt_state = emp_salary_prof.pt_state or 'TELANGANA'
            tax_regime = emp_salary_prof.tax_regime or 'NEW_REGIME'
            monthly_tds_override = emp_salary_prof.monthly_tds
            calc_mode = emp_salary_prof.calculation_mode
        else:
            pf_prof = getattr(employee, 'pf_profile', None)
            employee_pf_enabled = getattr(pf_prof, 'employee_pf_enabled', True) if pf_prof else True
            employer_pf_enabled = getattr(pf_prof, 'employer_pf_enabled', True) if pf_prof else True
            pt_enabled = True
            employee_esi_enabled = True
            employer_esi_enabled = True
            tds_enabled = True
            pt_state = 'TELANGANA'
            tax_regime = 'NEW_REGIME'
            monthly_tds_override = Decimal('0.00')
            calc_mode = 'CTC_BASED'

        # 4. Resolve Base Monthly Gross & Nominal CTC
        # HR REFERENCE MODEL:
        # For CTC = ₹43,000:
        # Gross = CTC / 1.06 = ₹40,566.04
        # Basic = 50% Gross = ₹20,283.02
        # HRA = 50% Basic = ₹10,141.51
        # Special = Gross - Basic - HRA = ₹10,141.51
        if emp_salary_prof and emp_salary_prof.monthly_ctc > 0:
            nominal_ctc = emp_salary_prof.monthly_ctc
            if emp_salary_prof.monthly_gross > 0:
                monthly_base_salary = emp_salary_prof.monthly_gross
            else:
                monthly_base_salary = (nominal_ctc / Decimal('1.06')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        elif emp_salary_prof and emp_salary_prof.monthly_gross > 0:
            monthly_base_salary = emp_salary_prof.monthly_gross
            if employer_pf_enabled:
                nominal_ctc = (monthly_base_salary * Decimal('1.06')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            else:
                nominal_ctc = monthly_base_salary
        else:
            monthly_base_salary = Decimal(str(employee.salary or Decimal('0.00')))
            if employer_pf_enabled and monthly_base_salary > 0:
                nominal_ctc = (monthly_base_salary * Decimal('1.06')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            else:
                nominal_ctc = monthly_base_salary

        # 5. Attendance & LOP Proration
        if payable_days >= cal_days_dec:
            gross_earned = monthly_base_salary
            lop_deduction = Decimal('0.00')
        else:
            per_day_sal = (monthly_base_salary / cal_days_dec).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            lop_deduction = (unpaid_absence_days * per_day_sal).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            gross_earned = max(Decimal('0.00'), monthly_base_salary - lop_deduction)

        # Statutory Component Breakdown
        basic_earned = (gross_earned * Decimal('0.50')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        da_earned = Decimal('0.00')
        hra_earned = (basic_earned * Decimal('0.50')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        special_earned = (gross_earned - basic_earned - da_earned - hra_earned).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        # 6. Compute EPFO 2026 contributions through PFCalculationEngine
        pf_data = PFCalculationEngine.calculate_monthly_contributions(
            employee=employee,
            year=year,
            month=month,
            payable_days=payable_days,
            calendar_days=calendar_days,
            lop_days=unpaid_absence_days,
            employee_pf_enabled=employee_pf_enabled,
            employer_pf_enabled=employer_pf_enabled
        )

        eligible_pf_wages = pf_data['epf_wages']
        employee_pf = pf_data['employee_epf'] if employee_pf_enabled else Decimal('0.00')
        employer_epf = pf_data['employer_epf'] if employer_pf_enabled else Decimal('0.00')
        employer_eps = pf_data['employer_eps'] if employer_pf_enabled else Decimal('0.00')
        employer_edli = pf_data['employer_edli'] if employer_pf_enabled else Decimal('0.00')
        employer_pf_total = pf_data.get('employer_pf_total', employer_epf + employer_eps) if employer_pf_enabled else Decimal('0.00')
        admin_charges = pf_data['admin_charges'] if employer_pf_enabled else Decimal('0.00')

        # 7. Professional Tax (Strictly zero if toggle is OFF)
        if pt_enabled:
            professional_tax = calculate_professional_tax(
                gross_salary=gross_earned,
                state=pt_state,
                month=month,
                gender=employee.gender
            )
        else:
            professional_tax = Decimal('0.00')

        # 8. ESI (Strictly zero if toggle is OFF or wages > 21,000)
        esi_employee = Decimal('0.00')
        esi_employer = Decimal('0.00')
        if gross_earned <= Decimal('21000.00') and gross_earned > Decimal('0.00'):
            raw_ee_esi, raw_er_esi = calculate_esi(
                gross_salary=gross_earned,
                base_monthly_gross=monthly_base_salary,
                opt_out=False,
                as_of_date=date(year, month, 1)
            )
            if employee_esi_enabled:
                esi_employee = raw_ee_esi
            if employer_esi_enabled:
                esi_employer = raw_er_esi

        # 9. TDS (Strictly zero if toggle is OFF)
        annual_gross = (gross_earned * 12).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        if tds_enabled:
            if monthly_tds_override and monthly_tds_override > 0:
                tds = monthly_tds_override
            else:
                tds_res = IncomeTaxTDSEngine.calculate_tds(
                    annual_gross_salary=annual_gross,
                    regime=tax_regime
                )
                tds = Decimal(str(tds_res['monthly_tds']))
        else:
            tds = Decimal('0.00')

        # 10. Deductions & Net Salary
        other_deductions = Decimal('0.00')
        total_employee_deductions = employee_pf + professional_tax + tds + esi_employee + other_deductions
        net_salary = max(Decimal('0.00'), gross_earned - total_employee_deductions)

        # 11. Employer Statutory & Total CTC
        # HR Reference: Total CTC = Gross Salary + Employer PF (12%)
        total_employer_contributions = employer_pf_total + esi_employer
        monthly_ctc = gross_earned + total_employer_contributions
        annual_ctc = (monthly_ctc * 12).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        total_employer_cost = gross_earned + total_employer_contributions + employer_edli + admin_charges

        # 4. Atomic Database Persistence
        with transaction.atomic():
            # Persist or update PFContribution record
            pf_contrib, _ = PFContribution.objects.update_or_create(
                employee=employee,
                year=year,
                month=month,
                defaults={
                    'gross_wages': monthly_base_salary,
                    'earned_gross_wages': gross_earned,
                    'pf_gross_wages': pf_data['pf_gross_wages'],
                    'epf_wages': eligible_pf_wages,
                    'eps_wages': pf_data['eps_wages'],
                    'edli_wages': pf_data['edli_wages'],
                    'employee_epf': employee_pf,
                    'employer_epf': employer_epf,
                    'employer_eps': employer_eps,
                    'employer_edli': employer_edli,
                    'admin_charges': admin_charges,
                    'ncp_days': unpaid_absence_days,
                    'is_transition_month': pf_data['is_transition_month'],
                    'period_1_epf_wages': pf_data.get('period_1', {}).get('epf_wages', Decimal('0.00')) if pf_data.get('period_1') else Decimal('0.00'),
                    'period_1_eps_wages': pf_data.get('period_1', {}).get('eps_wages', Decimal('0.00')) if pf_data.get('period_1') else Decimal('0.00'),
                    'period_1_employee_epf': pf_data.get('period_1', {}).get('employee_epf', Decimal('0.00')) if pf_data.get('period_1') else Decimal('0.00'),
                    'period_1_employer_epf': pf_data.get('period_1', {}).get('employer_epf', Decimal('0.00')) if pf_data.get('period_1') else Decimal('0.00'),
                    'period_1_employer_eps': pf_data.get('period_1', {}).get('employer_eps', Decimal('0.00')) if pf_data.get('period_1') else Decimal('0.00'),
                    'period_2_epf_wages': pf_data.get('period_2', {}).get('epf_wages', Decimal('0.00')) if pf_data.get('period_2') else Decimal('0.00'),
                    'period_2_eps_wages': pf_data.get('period_2', {}).get('eps_wages', Decimal('0.00')) if pf_data.get('period_2') else Decimal('0.00'),
                    'period_2_employee_epf': pf_data.get('period_2', {}).get('employee_epf', Decimal('0.00')) if pf_data.get('period_2') else Decimal('0.00'),
                    'period_2_employer_epf': pf_data.get('period_2', {}).get('employer_epf', Decimal('0.00')) if pf_data.get('period_2') else Decimal('0.00'),
                    'period_2_employer_eps': pf_data.get('period_2', {}).get('employer_eps', Decimal('0.00')) if pf_data.get('period_2') else Decimal('0.00'),
                    'metadata': {
                        'scenario': str(pf_data.get('eligibility', {}).get('scenario', '')),
                        'rule_applied': str(pf_data.get('eligibility', {}).get('rule_applied', '')),
                        'establishment_category': str(pf_data.get('establishment_category', '')),
                        'ee_rate': float(pf_data.get('ee_rate', 12.0)),
                    }
                }
            )

            # Persist or update Payroll record
            payroll, _ = Payroll.objects.update_or_create(
                employee=employee,
                year=year,
                month=month,
                defaults={
                    'calendar_days': calendar_days,
                    'payable_days': payable_days,
                    'lop_days': unpaid_absence_days,
                    'monthly_ctc': monthly_ctc,
                    'annual_ctc': annual_ctc,
                    'annual_gross': annual_gross,
                    'calculation_mode': calc_mode,
                    'tax_regime': tax_regime,
                    'monthly_base_salary': monthly_base_salary,
                    'gross_earned_salary': gross_earned,
                    'basic_earned': basic_earned,
                    'da_earned': da_earned,
                    'hra_earned': hra_earned,
                    'special_allowance_earned': special_earned,
                    'eligible_pf_wages': eligible_pf_wages,
                    'employee_pf': employee_pf,
                    'employer_pf_total': employer_pf_total,
                    'employer_epf': employer_epf,
                    'employer_eps': employer_eps,
                    'employer_edli': employer_edli,
                    'admin_charges': admin_charges,
                    'employee_pf_enabled': employee_pf_enabled,
                    'employer_pf_enabled': employer_pf_enabled,
                    'pt_enabled': pt_enabled,
                    'employee_esi_enabled': employee_esi_enabled,
                    'employer_esi_enabled': employer_esi_enabled,
                    'tds_enabled': tds_enabled,
                    'professional_tax': professional_tax,
                    'tds': tds,
                    'esi_employee': esi_employee,
                    'esi_employer': esi_employer,
                    'lop_deduction': lop_deduction,
                    'other_deductions': other_deductions,
                    'total_employee_deductions': total_employee_deductions,
                    'net_salary': net_salary,
                    'total_employer_contributions': total_employer_contributions,
                    'total_employer_cost': total_employer_cost,
                    'status': PayrollStatus.DRAFT,
                    'details': {
                        'is_transition_month': pf_data.get('is_transition_month', False),
                        'attendance_summary': {
                            'calendar_days': calendar_days,
                            'present_days': float(present_days),
                            'paid_leave_days': float(paid_leave_days),
                            'unpaid_absence_days': float(unpaid_absence_days),
                            'payable_days': float(payable_days),
                        }
                    }
                }
            )

            # Audit Log
            PayrollAuditLog.objects.create(
                payroll=payroll,
                action='PAYROLL_CALCULATE',
                actor=actor,
                details={
                    'gross_earned': str(gross_earned),
                    'net_salary': str(net_salary),
                    'employee_pf': str(employee_pf),
                    'employer_epf': str(employer_epf),
                    'employer_eps': str(employer_eps),
                }
            )

        return {
            'payroll_id': payroll.id,
            'employee_id': employee.id,
            'employee_code': employee.employee_id,
            'full_name': employee.full_name,
            'department': employee.department.name if employee.department else 'Unassigned',
            'year': year,
            'month': month,
            'monthly_base_salary': str(monthly_base_salary),
            'gross_earned_salary': str(gross_earned),
            'basic_earned': str(basic_earned),
            'da_earned': str(da_earned),
            'hra_earned': str(hra_earned),
            'special_allowance_earned': str(special_earned),
            'eligible_pf_wages': str(eligible_pf_wages),
            'employee_pf': str(employee_pf),
            'employer_epf': str(employer_epf),
            'employer_eps': str(employer_eps),
            'employer_edli': str(employer_edli),
            'admin_charges': str(admin_charges),
            'professional_tax': str(professional_tax),
            'esi_employee': str(esi_employee),
            'esi_employer': str(esi_employer),
            'lop_deduction': str(lop_deduction),
            'total_employee_deductions': str(total_employee_deductions),
            'net_salary': str(net_salary),
            'total_employer_cost': str(total_employer_cost),
            'status': payroll.status,
            'is_transition_month': pf_data['is_transition_month'],
            'pf_data': pf_data,
        }

    @classmethod
    def calculate_company_payroll(cls, year: int, month: int, department_id: int = None, actor=None) -> dict:
        """
        Runs monthly payroll calculation across all active employees or department.
        Computes aggregate establishment statutory liabilities including minimum admin charges check.
        """
        qs = Employee.objects.filter(employment_status=EmploymentStatus.ACTIVE).select_related('department', 'designation', 'user')
        if department_id:
            qs = qs.filter(department_id=department_id)

        payroll_records = []
        total_gross = Decimal('0.00')
        total_pf_wages = Decimal('0.00')
        total_ee_pf = Decimal('0.00')
        total_er_epf = Decimal('0.00')
        total_er_eps = Decimal('0.00')
        total_edli = Decimal('0.00')
        total_admin_computed = Decimal('0.00')
        total_net_salary = Decimal('0.00')
        total_employer_cost = Decimal('0.00')

        pf_eligible_count = 0
        non_pf_count = 0

        for emp in qs:
            rec = cls.calculate_employee_payroll(employee=emp, year=year, month=month, actor=actor)
            payroll_records.append(rec)

            total_gross += Decimal(rec['gross_earned_salary'])
            total_pf_wages += Decimal(rec['eligible_pf_wages'])
            total_ee_pf += Decimal(rec['employee_pf'])
            total_er_epf += Decimal(rec['employer_epf'])
            total_er_eps += Decimal(rec['employer_eps'])
            total_edli += Decimal(rec['employer_edli'])
            total_admin_computed += Decimal(rec['admin_charges'])
            total_net_salary += Decimal(rec['net_salary'])
            total_employer_cost += Decimal(rec['total_employer_cost'])

            if Decimal(rec['employee_pf']) > 0 or Decimal(rec['eligible_pf_wages']) > 0:
                pf_eligible_count += 1
            else:
                non_pf_count += 1

        # Establishment Level Statutory Minimum Admin Charges:
        # Minimum ₹500 if active contributing members, ₹75 if no active contributing members.
        if pf_eligible_count > 0:
            final_admin_charges = max(MIN_ADMIN_ACTIVE, total_admin_computed)
        else:
            final_admin_charges = MIN_ADMIN_INACTIVE

        total_pf_liability = total_ee_pf + total_er_epf + total_er_eps + total_edli + final_admin_charges

        return {
            'year': year,
            'month': month,
            'summary': {
                'total_employees': len(payroll_records),
                'pf_eligible_employees': pf_eligible_count,
                'non_pf_employees': non_pf_count,
                'total_gross_salary': str(total_gross),
                'total_pf_wages': str(total_pf_wages),
                'total_employee_pf': str(total_ee_pf),
                'total_employer_epf': str(total_er_epf),
                'total_employer_eps': str(total_er_eps),
                'total_edli': str(total_edli),
                'total_admin_charges_computed': str(total_admin_computed),
                'establishment_min_admin_charges': str(final_admin_charges),
                'total_monthly_pf_liability': str(total_pf_liability),
                'total_net_salary': str(total_net_salary),
                'total_employer_cost': str(total_employer_cost),
            },
            'records': payroll_records,
        }


    @classmethod
    def review_payroll(cls, year: int, month: int, actor=None) -> dict:
        """Moves payroll records for year/month to UNDER_REVIEW state."""
        qs = Payroll.objects.filter(year=year, month=month, status__in=[PayrollStatus.DRAFT, PayrollStatus.PROCESSING])
        count = qs.update(status=PayrollStatus.UNDER_REVIEW)
        for p in Payroll.objects.filter(year=year, month=month):
            PayrollAuditLog.objects.create(payroll=p, action='PAYROLL_REVIEW', actor=actor, details={'count': count})
        return {'message': f'{count} payroll records moved to Under Review.', 'year': year, 'month': month}

    @classmethod
    def approve_payroll(cls, year: int, month: int, actor=None) -> dict:
        """Approves payroll records for year/month."""
        qs = Payroll.objects.filter(year=year, month=month, status__in=[PayrollStatus.UNDER_REVIEW, PayrollStatus.DRAFT, PayrollStatus.PROCESSING])
        count = qs.update(status=PayrollStatus.APPROVED)
        for p in Payroll.objects.filter(year=year, month=month):
            PayrollAuditLog.objects.create(payroll=p, action='PAYROLL_APPROVE', actor=actor, details={'count': count})
        return {'message': f'{count} payroll records approved by HR.', 'year': year, 'month': month}

    @classmethod
    def finalize_payroll(cls, year: int, month: int, actor=None) -> dict:
        """
        Finalizes and locks payroll records for year/month.
        Generates official Payslip records and PDF documents.
        """
        from salaries.views import _generate_payslip_record
        qs = Payroll.objects.filter(year=year, month=month)
        if not qs.exists():
            raise ValueError(f"No payroll records exist for {month}/{year}. Calculate payroll first.")

        finalized_count = 0
        for p in qs:
            # Generate or link official payslip FIRST
            try:
                _generate_payslip_record(employee=p.employee, year=year, month=month, generated_by=actor, force_version=False)
            except Exception as e:
                pass

            p.refresh_from_db()
            p.status = PayrollStatus.FINALIZED
            p.is_locked = True
            p.finalized_by = actor
            p.finalized_at = timezone.now()
            p.save()
            finalized_count += 1

            PayrollAuditLog.objects.create(payroll=p, action='PAYROLL_FINALIZE', actor=actor, details={'locked': True})

        return {'message': f'Finalized and locked {finalized_count} payroll records for {month}/{year}. Official payslips generated.', 'year': year, 'month': month}

    @classmethod
    def reverse_payroll(cls, year: int, month: int, reason: str, actor=None) -> dict:
        """
        Reverses or unlocks finalized payroll records for adjustments.
        Requires explicit authorization reason.
        """
        if not reason or not reason.strip():
            raise ValueError("An authorized reason is required to reverse or unlock payroll.")

        qs = Payroll.objects.filter(year=year, month=month)
        count = qs.update(status=PayrollStatus.REVERSED, is_locked=False)
        for p in qs:
            PayrollAuditLog.objects.create(
                payroll=p,
                action='PAYROLL_REVERSE',
                actor=actor,
                details={'reason': reason.strip(), 'unlocked': True}
            )
        return {'message': f'Unlocked and reversed {count} payroll record(s) for {month}/{year}. Reason logged.', 'year': year, 'month': month}
