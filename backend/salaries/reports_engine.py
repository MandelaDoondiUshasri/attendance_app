"""
EPFO Compliance & Reporting Engine.
Generates:
1. Monthly PF report
2. Employee-wise PF report
3. Employer contribution report
4. EPS report
5. EDLI report
6. PF eligibility report
7. PF reconciliation report
8. September 2026 transition report
9. Annual PF contribution report
10. EPFO ECR Reconciliation format export
"""

import csv
import io
from datetime import date
from decimal import Decimal
import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter

from employees.models import Employee, EmploymentStatus
from salaries.models import PFContribution, Payroll, EmployeePFProfile, PFConfiguration
from salaries.pf_engine import (
    PFEligibilityEngine, PFCalculationEngine,
    OLD_CEILING, NEW_CEILING, TRANSITION_DATE
)


class PFReportsEngine:
    """
    Produces statutory PF reconciliation reports, Excel/CSV workbooks,
    and ECR electronic return preview files.
    """

    @classmethod
    def get_monthly_pf_report(cls, year: int, month: int, department_id: int = None) -> dict:
        """
        Monthly comprehensive PF contribution statement.
        """
        qs = PFContribution.objects.filter(year=year, month=month).select_related('employee', 'employee__department', 'employee__pf_profile')
        if department_id:
            qs = qs.filter(employee__department_id=department_id)

        rows = []
        total_gross = Decimal('0.00')
        total_epf_wages = Decimal('0.00')
        total_eps_wages = Decimal('0.00')
        total_edli_wages = Decimal('0.00')
        total_ee_pf = Decimal('0.00')
        total_er_epf = Decimal('0.00')
        total_er_eps = Decimal('0.00')
        total_er_edli = Decimal('0.00')
        total_admin = Decimal('0.00')

        for c in qs:
            emp = c.employee
            prof = getattr(emp, 'pf_profile', None)
            uan = prof.uan_number if prof and prof.uan_number else 'N/A'
            pf_num = prof.pf_account_number if prof and prof.pf_account_number else 'N/A'

            rows.append({
                'employee_id': emp.id,
                'employee_code': emp.employee_id,
                'full_name': emp.full_name,
                'department': emp.department.name if emp.department else 'Unassigned',
                'uan': uan,
                'pf_account_number': pf_num,
                'gross_wages': float(c.earned_gross_wages or c.gross_wages),
                'epf_wages': float(c.epf_wages),
                'eps_wages': float(c.eps_wages),
                'edli_wages': float(c.edli_wages),
                'employee_epf': float(c.employee_epf),
                'employer_epf': float(c.employer_epf),
                'employer_eps': float(c.employer_eps),
                'employer_edli': float(c.employer_edli),
                'admin_charges': float(c.admin_charges),
                'ncp_days': float(c.ncp_days),
                'total_remittance': float(c.employee_epf + c.employer_epf + c.employer_eps + c.employer_edli + c.admin_charges),
            })

            total_gross += c.earned_gross_wages or c.gross_wages
            total_epf_wages += c.epf_wages
            total_eps_wages += c.eps_wages
            total_edli_wages += c.edli_wages
            total_ee_pf += c.employee_epf
            total_er_epf += c.employer_epf
            total_er_eps += c.employer_eps
            total_er_edli += c.employer_edli
            total_admin += c.admin_charges

        # Minimum admin charges check
        est_min_admin = Decimal('500.00') if len(rows) > 0 else Decimal('75.00')
        final_admin = max(est_min_admin, total_admin)
        total_statutory_remittance = total_ee_pf + total_er_epf + total_er_eps + total_er_edli + final_admin

        return {
            'report_title': f'Monthly EPF / PF Statutory Remittance Statement - {month:02d}/{year}',
            'year': year,
            'month': month,
            'statutory_ceiling': 25000.00 if date(year, month, 1) >= TRANSITION_DATE else 15000.00,
            'summary': {
                'total_members': len(rows),
                'total_gross_wages': float(total_gross),
                'total_epf_wages': float(total_epf_wages),
                'total_eps_wages': float(total_eps_wages),
                'total_edli_wages': float(total_edli_wages),
                'total_employee_epf': float(total_ee_pf),
                'total_employer_epf': float(total_er_epf),
                'total_employer_eps': float(total_er_eps),
                'total_employer_edli': float(total_er_edli),
                'total_admin_charges_computed': float(total_admin),
                'establishment_min_admin_charges': float(final_admin),
                'total_statutory_remittance': float(total_statutory_remittance),
            },
            'rows': rows,
            'compliance_disclaimer': 'Internal Compliance Reconciliation Statement. Not an official EPFO submission.'
        }

    @classmethod
    def get_employee_pf_report(cls, employee_id: int, year: int) -> dict:
        """
        Yearly cumulative contribution history for a single employee.
        """
        emp = Employee.objects.filter(id=employee_id).select_related('department', 'designation', 'pf_profile').first()
        if not emp:
            raise ValueError("Employee not found.")

        contribs = PFContribution.objects.filter(employee=emp, year=year).order_by('month')
        rows = []
        tot_ee = Decimal('0.00')
        tot_er_epf = Decimal('0.00')
        tot_er_eps = Decimal('0.00')
        tot_edli = Decimal('0.00')

        for c in contribs:
            rows.append({
                'month': c.month,
                'gross_wages': float(c.earned_gross_wages),
                'epf_wages': float(c.epf_wages),
                'eps_wages': float(c.eps_wages),
                'employee_epf': float(c.employee_epf),
                'employer_epf': float(c.employer_epf),
                'employer_eps': float(c.employer_eps),
                'employer_edli': float(c.employer_edli),
                'ncp_days': float(c.ncp_days),
                'is_transition': c.is_transition_month,
            })
            tot_ee += c.employee_epf
            tot_er_epf += c.employer_epf
            tot_er_eps += c.employer_eps
            tot_edli += c.employer_edli

        prof = getattr(emp, 'pf_profile', None)
        return {
            'employee_name': emp.full_name,
            'employee_code': emp.employee_id,
            'department': emp.department.name if emp.department else 'Unassigned',
            'uan': prof.uan_number if prof else 'N/A',
            'pf_account_number': prof.pf_account_number if prof else 'N/A',
            'year': year,
            'summary': {
                'total_employee_epf': float(tot_ee),
                'total_employer_epf': float(tot_er_epf),
                'total_employer_eps': float(tot_er_eps),
                'total_employer_edli': float(tot_edli),
                'cumulative_pf_savings': float(tot_ee + tot_er_epf),
            },
            'rows': rows,
        }

    @classmethod
    def get_employer_contribution_report(cls, year: int, month: int) -> dict:
        """
        Detailed Employer Statutory Expense Statement:
        Account 1 (EPF 3.67%), Account 10 (EPS 8.33%), Account 21 (EDLI 0.50%), Account 2 (Admin 0.50%).
        """
        base = cls.get_monthly_pf_report(year, month)
        sum_data = base['summary']

        ac1_er = sum_data['total_employer_epf']
        ac10_eps = sum_data['total_employer_eps']
        ac21_edli = sum_data['total_employer_edli']
        ac2_admin = sum_data['establishment_min_admin_charges']
        total_er_cost = ac1_er + ac10_eps + ac21_edli + ac2_admin

        return {
            'report_title': f'Employer Statutory EPF / EPS / EDLI Cost Report - {month:02d}/{year}',
            'year': year,
            'month': month,
            'accounts': {
                'account_1_er_epf': ac1_er,
                'account_10_er_eps': ac10_eps,
                'account_21_er_edli': ac21_edli,
                'account_2_admin_charges': ac2_admin,
                'total_employer_liability': total_er_cost,
            },
            'rows': base['rows'],
            'note': 'Employer contributions are an operational expense of the establishment and are not deducted from employee salary.'
        }

    @classmethod
    def get_eps_report(cls, year: int, month: int) -> dict:
        """
        Employees' Pension Scheme (EPS Account 10) statement.
        Tracks member pensionable wages, EPS 8.33% allocations, and age status (<58 vs >=58).
        """
        qs = PFContribution.objects.filter(year=year, month=month).select_related('employee', 'employee__department', 'employee__pf_profile')
        rows = []
        tot_eps_wage = Decimal('0.00')
        tot_eps_er = Decimal('0.00')
        eps_members_count = 0
        superannuated_count = 0

        as_of = date(year, month, 1)

        for c in qs:
            emp = c.employee
            prof = getattr(emp, 'pf_profile', None)
            is_eps_age = prof.is_eps_eligible_by_age(as_of) if prof else True
            age = None
            if emp.dob:
                age = as_of.year - emp.dob.year - ((as_of.month, as_of.day) < (emp.dob.month, emp.dob.day))

            if not is_eps_age:
                superannuated_count += 1
            else:
                eps_members_count += 1

            rows.append({
                'employee_code': emp.employee_id,
                'full_name': emp.full_name,
                'department': emp.department.name if emp.department else 'Unassigned',
                'uan': prof.uan_number if prof and prof.uan_number else 'N/A',
                'age': age,
                'eps_eligible': is_eps_age and (prof.eps_member if prof else True),
                'eps_wages': float(c.eps_wages),
                'employer_eps_contribution': float(c.employer_eps),
                'superannuation_status': 'Aged 58+ (Full 12% to EPF)' if not is_eps_age else 'Active EPS Member'
            })
            tot_eps_wage += c.eps_wages
            tot_eps_er += c.employer_eps

        return {
            'report_title': f'Employees\' Pension Scheme (EPS Account 10) Report - {month:02d}/{year}',
            'year': year,
            'month': month,
            'summary': {
                'active_eps_members': eps_members_count,
                'superannuated_members': superannuated_count,
                'total_eps_wages': float(tot_eps_wage),
                'total_eps_contribution': float(tot_eps_er),
            },
            'rows': rows,
        }

    @classmethod
    def get_edli_report(cls, year: int, month: int) -> dict:
        """
        Employees' Deposit-Linked Insurance (EDLI Account 21) statement.
        """
        qs = PFContribution.objects.filter(year=year, month=month).select_related('employee', 'employee__department', 'employee__pf_profile')
        rows = []
        tot_edli_wage = Decimal('0.00')
        tot_edli_er = Decimal('0.00')

        for c in qs:
            emp = c.employee
            prof = getattr(emp, 'pf_profile', None)
            rows.append({
                'employee_code': emp.employee_id,
                'full_name': emp.full_name,
                'department': emp.department.name if emp.department else 'Unassigned',
                'uan': prof.uan_number if prof and prof.uan_number else 'N/A',
                'edli_wages': float(c.edli_wages),
                'employer_edli_contribution': float(c.employer_edli),
            })
            tot_edli_wage += c.edli_wages
            tot_edli_er += c.employer_edli

        return {
            'report_title': f'EDLI Scheme (Account 21) Report - {month:02d}/{year}',
            'year': year,
            'month': month,
            'summary': {
                'covered_members': len(rows),
                'total_edli_wages': float(tot_edli_wage),
                'total_edli_contribution': float(tot_edli_er),
            },
            'rows': rows,
        }

    @classmethod
    def get_pf_eligibility_report(cls, as_of_date: date = None) -> dict:
        """
        Complete audit of employee PF eligibility statuses, entry ceilings,
        and exclusion reasons under 2026 rules.
        """
        if as_of_date is None:
            as_of_date = date.today()

        employees = Employee.objects.all().select_related('department', 'designation', 'pf_profile')
        rows = []
        covered_count = 0
        excluded_count = 0

        for emp in employees:
            prof = getattr(emp, 'pf_profile', None)
            base_sal = Decimal(str(emp.salary or Decimal('0.00')))
            basic_pct = Decimal(str(prof.basic_percentage or 50.00)) if prof else Decimal('50.00')
            nominal_pf_wage = (base_sal * basic_pct / Decimal('100.00')).quantize(Decimal('0.01'))

            assessment = PFEligibilityEngine.assess_eligibility(
                employee=emp,
                as_of_date=as_of_date,
                monthly_pf_wages=nominal_pf_wage
            )

            is_covered = assessment['pf_applicable'] and not assessment['is_excluded']
            if is_covered:
                covered_count += 1
            else:
                excluded_count += 1

            rows.append({
                'employee_id': emp.id,
                'employee_code': emp.employee_id,
                'full_name': emp.full_name,
                'department': emp.department.name if emp.department else 'Unassigned',
                'joining_date': emp.joining_date.strftime('%d/%m/%Y') if emp.joining_date else 'N/A',
                'monthly_gross_salary': float(base_sal),
                'monthly_pf_wage': float(nominal_pf_wage),
                'uan': prof.uan_number if prof and prof.uan_number else 'N/A',
                'previous_pf_membership': prof.previous_pf_membership if prof else False,
                'is_international_worker': prof.international_worker if prof else False,
                'is_pf_eligible': is_covered,
                'epf_member': assessment['epf_member'],
                'eps_member': assessment['eps_member'],
                'scenario': assessment.get('scenario', 'STANDARD'),
                'rule_applied': assessment.get('rule_applied', ''),
                'exclusion_reason': assessment.get('exclusion_reason', ''),
            })

        return {
            'report_title': f'Employee PF & EPS Statutory Eligibility Audit Report (as of {as_of_date.strftime("%d/%m/%Y")})',
            'as_of_date': as_of_date.isoformat(),
            'current_wage_ceiling': float(NEW_CEILING if as_of_date >= TRANSITION_DATE else OLD_CEILING),
            'summary': {
                'total_employees': len(employees),
                'covered_employees': covered_count,
                'excluded_employees': excluded_count,
            },
            'rows': rows,
        }

    @classmethod
    def get_reconciliation_report(cls, year: int, month: int) -> dict:
        """
        Reconciles Gross Salaries, Attendance deductions, PF Wages,
        Employee Deductions, and Net Salaries.
        """
        payrolls = Payroll.objects.filter(year=year, month=month).select_related('employee', 'employee__department')
        rows = []
        tot_gross = Decimal('0.00')
        tot_lop = Decimal('0.00')
        tot_pf_wages = Decimal('0.00')
        tot_ee_pf = Decimal('0.00')
        tot_other_ded = Decimal('0.00')
        tot_net = Decimal('0.00')

        discrepancies = []

        for p in payrolls:
            rows.append({
                'employee_code': p.employee.employee_id,
                'full_name': p.employee.full_name,
                'gross_earned': float(p.gross_earned_salary),
                'lop_deduction': float(p.lop_deduction),
                'eligible_pf_wages': float(p.eligible_pf_wages),
                'employee_pf': float(p.employee_pf),
                'professional_tax': float(p.professional_tax),
                'other_deductions': float(p.other_deductions),
                'total_deductions': float(p.total_employee_deductions),
                'net_salary': float(p.net_salary),
            })
            tot_gross += p.gross_earned_salary
            tot_lop += p.lop_deduction
            tot_pf_wages += p.eligible_pf_wages
            tot_ee_pf += p.employee_pf
            tot_other_ded += p.professional_tax + p.other_deductions
            tot_net += p.net_salary

            # Reconciliation check: Net Salary + Total Deductions == Gross Earned
            expected_gross = p.net_salary + p.total_employee_deductions
            if abs(expected_gross - p.gross_earned_salary) > Decimal('0.05'):
                discrepancies.append(f"{p.employee.full_name}: Net + Deductions (₹{expected_gross}) != Gross (₹{p.gross_earned_salary})")

        return {
            'report_title': f'Monthly Payroll & PF Statutory Reconciliation Report - {month:02d}/{year}',
            'year': year,
            'month': month,
            'summary': {
                'total_gross_earned': float(tot_gross),
                'total_lop_deductions': float(tot_lop),
                'total_eligible_pf_wages': float(tot_pf_wages),
                'total_employee_pf': float(tot_ee_pf),
                'total_other_deductions': float(tot_other_ded),
                'total_net_salary': float(tot_net),
                'is_fully_reconciled': len(discrepancies) == 0,
                'discrepancy_count': len(discrepancies),
            },
            'discrepancies': discrepancies,
            'rows': rows,
        }

    @classmethod
    def get_september_transition_report(cls) -> dict:
        """
        Specialized audit report for the September 2026 split transition (Gazette S.O. 5109(E)).
        Reveals Period 1 (1-16 Sep @ ₹15,000 ceiling) vs Period 2 (17-30 Sep @ ₹25,000 ceiling) breakdown.
        """
        contribs = PFContribution.objects.filter(year=2026, month=9).select_related('employee', 'employee__department', 'employee__pf_profile')
        rows = []

        tot_p1_wages = Decimal('0.00')
        tot_p1_ee = Decimal('0.00')
        tot_p1_er_epf = Decimal('0.00')
        tot_p1_er_eps = Decimal('0.00')

        tot_p2_wages = Decimal('0.00')
        tot_p2_ee = Decimal('0.00')
        tot_p2_er_epf = Decimal('0.00')
        tot_p2_er_eps = Decimal('0.00')

        tot_combined_ee = Decimal('0.00')
        tot_combined_er = Decimal('0.00')

        for c in contribs:
            emp = c.employee
            prof = getattr(emp, 'pf_profile', None)

            p1_wage = c.period_1_epf_wages
            p1_ee = c.period_1_employee_epf
            p1_epf = c.period_1_employer_epf
            p1_eps = c.period_1_employer_eps

            p2_wage = c.period_2_epf_wages
            p2_ee = c.period_2_employee_epf
            p2_epf = c.period_2_employer_epf
            p2_eps = c.period_2_employer_eps

            rows.append({
                'employee_code': emp.employee_id,
                'full_name': emp.full_name,
                'department': emp.department.name if emp.department else 'Unassigned',
                'uan': prof.uan_number if prof and prof.uan_number else 'N/A',
                'period_1': {
                    'dates': '01/09/2026 - 16/09/2026',
                    'ceiling': 15000.00,
                    'prorated_ceiling': 8000.00,
                    'epf_wages': float(p1_wage),
                    'eps_wages': float(c.period_1_eps_wages),
                    'employee_epf': float(p1_ee),
                    'employer_epf': float(p1_epf),
                    'employer_eps': float(p1_eps),
                },
                'period_2': {
                    'dates': '17/09/2026 - 30/09/2026',
                    'ceiling': 25000.00,
                    'prorated_ceiling': 11666.67,
                    'epf_wages': float(p2_wage),
                    'eps_wages': float(c.period_2_eps_wages),
                    'employee_epf': float(p2_ee),
                    'employer_epf': float(p2_epf),
                    'employer_eps': float(p2_eps),
                },
                'combined': {
                    'total_epf_wages': float(c.epf_wages),
                    'total_eps_wages': float(c.eps_wages),
                    'total_ee_pf': float(c.employee_epf),
                    'total_er_pf': float(c.employer_epf + c.employer_eps),
                }
            })

            tot_p1_wages += p1_wage
            tot_p1_ee += p1_ee
            tot_p1_er_epf += p1_epf
            tot_p1_er_eps += p1_eps

            tot_p2_wages += p2_wage
            tot_p2_ee += p2_ee
            tot_p2_er_epf += p2_epf
            tot_p2_er_eps += p2_eps

            tot_combined_ee += c.employee_epf
            tot_combined_er += (c.employer_epf + c.employer_eps)

        return {
            'report_title': 'September 2026 Statutory Ceiling Transition Audit Report (Gazette S.O. 5109(E))',
            'effective_date': '17/09/2026',
            'period_1_summary': {
                'dates': '1 Sep 2026 – 16 Sep 2026 (16 days)',
                'applicable_ceiling': 15000.00,
                'prorated_ceiling': 8000.00,
                'total_epf_wages': float(tot_p1_wages),
                'total_employee_epf': float(tot_p1_ee),
                'total_employer_epf': float(tot_p1_er_epf),
                'total_employer_eps': float(tot_p1_er_eps),
            },
            'period_2_summary': {
                'dates': '17 Sep 2026 – 30 Sep 2026 (14 days)',
                'applicable_ceiling': 25000.00,
                'prorated_ceiling': 11666.67,
                'total_epf_wages': float(tot_p2_wages),
                'total_employee_epf': float(tot_p2_ee),
                'total_employer_epf': float(tot_p2_er_epf),
                'total_employer_eps': float(tot_p2_er_eps),
            },
            'combined_month_summary': {
                'total_employee_epf': float(tot_combined_ee),
                'total_employer_contribution': float(tot_combined_er),
                'filing_mode': 'Single Consolidated ECR File',
            },
            'rows': rows,
        }

    @classmethod
    def get_annual_pf_report(cls, year: int) -> dict:
        """
        12-month consolidated annual PF contribution ledger.
        """
        contribs = PFContribution.objects.filter(year=year).select_related('employee', 'employee__department')
        by_emp = {}

        for c in contribs:
            eid = c.employee.id
            if eid not in by_emp:
                by_emp[eid] = {
                    'employee_code': c.employee.employee_id,
                    'full_name': c.employee.full_name,
                    'department': c.employee.department.name if c.employee.department else 'Unassigned',
                    'months_contributed': 0,
                    'total_gross': Decimal('0.00'),
                    'total_epf_wages': Decimal('0.00'),
                    'total_ee_pf': Decimal('0.00'),
                    'total_er_epf': Decimal('0.00'),
                    'total_er_eps': Decimal('0.00'),
                    'total_edli': Decimal('0.00'),
                }
            by_emp[eid]['months_contributed'] += 1
            by_emp[eid]['total_gross'] += c.earned_gross_wages
            by_emp[eid]['total_epf_wages'] += c.epf_wages
            by_emp[eid]['total_ee_pf'] += c.employee_epf
            by_emp[eid]['total_er_epf'] += c.employer_epf
            by_emp[eid]['total_er_eps'] += c.employer_eps
            by_emp[eid]['total_edli'] += c.employer_edli

        rows = []
        for v in by_emp.values():
            rows.append({
                'employee_code': v['employee_code'],
                'full_name': v['full_name'],
                'department': v['department'],
                'months_contributed': v['months_contributed'],
                'total_gross': float(v['total_gross']),
                'total_epf_wages': float(v['total_epf_wages']),
                'total_ee_pf': float(v['total_ee_pf']),
                'total_er_epf': float(v['total_er_epf']),
                'total_er_eps': float(v['total_er_eps']),
                'total_edli': float(v['total_edli']),
                'total_contribution': float(v['total_ee_pf'] + v['total_er_epf'] + v['total_er_eps']),
            })

        return {
            'report_title': f'Annual PF Statutory Contribution Ledger - Calendar Year {year}',
            'year': year,
            'total_participating_employees': len(rows),
            'rows': rows,
        }

    # ── EXPORT ENGINE (CSV, EXCEL, ECR) ──────────────────────────────────────

    @classmethod
    def export_to_csv(cls, report_data: dict, report_type: str) -> str:
        """
        Converts report data to CSV string.
        """
        output = io.StringIO()
        writer = csv.writer(output)

        rows = report_data.get('rows', [])
        if not rows:
            return "No data available."

        if report_type == 'monthly':
            writer.writerow([
                'Employee Code', 'Employee Name', 'Department', 'UAN', 'PF Account No',
                'Gross Wages', 'EPF Wages', 'EPS Wages', 'EDLI Wages',
                'Employee EPF (12%)', 'Employer EPF (3.67%)', 'Employer EPS (8.33%)',
                'EDLI (0.50%)', 'Admin Charges', 'NCP Days', 'Total Remittance'
            ])
            for r in rows:
                writer.writerow([
                    r['employee_code'], r['full_name'], r['department'], r['uan'], r['pf_account_number'],
                    f"{r['gross_wages']:.2f}", f"{r['epf_wages']:.2f}", f"{r['eps_wages']:.2f}", f"{r['edli_wages']:.2f}",
                    f"{r['employee_epf']:.2f}", f"{r['employer_epf']:.2f}", f"{r['employer_eps']:.2f}",
                    f"{r['employer_edli']:.2f}", f"{r['admin_charges']:.2f}", f"{r['ncp_days']:.1f}", f"{r['total_remittance']:.2f}"
                ])
        elif report_type == 'september_transition':
            writer.writerow([
                'Employee Code', 'Employee Name', 'Department', 'UAN',
                'P1 EPF Wages (1-16 Sep)', 'P1 EE PF', 'P1 ER EPF', 'P1 ER EPS',
                'P2 EPF Wages (17-30 Sep)', 'P2 EE PF', 'P2 ER EPF', 'P2 ER EPS',
                'Total EPF Wages', 'Total EE PF', 'Total ER PF'
            ])
            for r in rows:
                p1 = r['period_1']
                p2 = r['period_2']
                comb = r['combined']
                writer.writerow([
                    r['employee_code'], r['full_name'], r['department'], r['uan'],
                    f"{p1['epf_wages']:.2f}", f"{p1['employee_epf']:.2f}", f"{p1['employer_epf']:.2f}", f"{p1['employer_eps']:.2f}",
                    f"{p2['epf_wages']:.2f}", f"{p2['employee_epf']:.2f}", f"{p2['employer_epf']:.2f}", f"{p2['employer_eps']:.2f}",
                    f"{comb['total_epf_wages']:.2f}", f"{comb['total_ee_pf']:.2f}", f"{comb['total_er_pf']:.2f}"
                ])
        else:
            # Generic export of first row keys
            keys = list(rows[0].keys())
            writer.writerow(keys)
            for r in rows:
                writer.writerow([r.get(k, '') for k in keys])

        return output.getvalue()

    @classmethod
    def export_to_excel(cls, report_data: dict, report_type: str) -> bytes:
        """
        Builds a styled corporate Excel workbook (.xlsx) using openpyxl.
        """
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = report_type[:30].replace('_', ' ').title()

        title_font = Font(name='Calibri', size=14, bold=True, color='1E293B')
        header_font = Font(name='Calibri', size=11, bold=True, color='FFFFFF')
        header_fill = PatternFill(start_color='1E3A8A', end_color='1E3A8A', fill_type='solid') # Corporate Navy
        data_font = Font(name='Calibri', size=10)
        border_thin = Border(
            left=Side(style='thin', color='CBD5E1'),
            right=Side(style='thin', color='CBD5E1'),
            top=Side(style='thin', color='CBD5E1'),
            bottom=Side(style='thin', color='CBD5E1')
        )

        ws.cell(row=1, column=1, value=report_data.get('report_title', 'EPF Compliance Report')).font = title_font
        ws.cell(row=2, column=1, value=report_data.get('compliance_disclaimer', 'Internal Compliance Document - Strictly for Reconciliation')).font = Font(size=9, italic=True, color='64748B')

        start_row = 4
        rows = report_data.get('rows', [])
        if not rows:
            ws.cell(row=start_row, column=1, value="No records found.")
            buf = io.BytesIO()
            wb.save(buf)
            return buf.getvalue()

        if report_type == 'monthly':
            headers = [
                'Emp Code', 'Employee Name', 'Department', 'UAN', 'PF Account No',
                'Gross Wages', 'EPF Wages', 'EPS Wages', 'EDLI Wages',
                'EE EPF (12%)', 'ER EPF (3.67%)', 'ER EPS (8.33%)',
                'EDLI (0.50%)', 'Admin Charges', 'NCP Days', 'Total Remittance'
            ]
            for col_idx, h in enumerate(headers, 1):
                cell = ws.cell(row=start_row, column=col_idx, value=h)
                cell.font = header_font
                cell.fill = header_fill
                cell.alignment = Alignment(horizontal='center', vertical='center')

            curr_row = start_row + 1
            for r in rows:
                row_vals = [
                    r['employee_code'], r['full_name'], r['department'], r['uan'], r['pf_account_number'],
                    r['gross_wages'], r['epf_wages'], r['eps_wages'], r['edli_wages'],
                    r['employee_epf'], r['employer_epf'], r['employer_eps'],
                    r['employer_edli'], r['admin_charges'], r['ncp_days'], r['total_remittance']
                ]
                for col_idx, v in enumerate(row_vals, 1):
                    cell = ws.cell(row=curr_row, column=col_idx, value=v)
                    cell.font = data_font
                    cell.border = border_thin
                    if col_idx >= 6:
                        cell.number_format = '#,##0.00' if col_idx != 15 else '0.0'
                curr_row += 1
        else:
            keys = [k for k in rows[0].keys() if not isinstance(rows[0][k], dict)]
            for col_idx, k in enumerate(keys, 1):
                cell = ws.cell(row=start_row, column=col_idx, value=k.replace('_', ' ').title())
                cell.font = header_font
                cell.fill = header_fill

            curr_row = start_row + 1
            for r in rows:
                for col_idx, k in enumerate(keys, 1):
                    cell = ws.cell(row=curr_row, column=col_idx, value=r.get(k, ''))
                    cell.font = data_font
                    cell.border = border_thin
                curr_row += 1

        # Adjust column widths
        for col in ws.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()

    @classmethod
    def export_to_ecr_text(cls, year: int, month: int) -> str:
        """
        Generates standard EPFO Electronic Challan cum Return (ECR) text format.
        Format specification:
        UAN#~#MEMBER_NAME#~#GROSS_WAGES#~#EPF_WAGES#~#EPS_WAGES#~#EDLI_WAGES#~#EE_SHARE#~#EPS_SHARE#~#ER_SHARE#~#NCP_DAYS#~#REFUND_ADVANCES
        Note: For September 2026, single consolidated return is produced as prescribed by EPFO.
        """
        contribs = PFContribution.objects.filter(year=year, month=month).select_related('employee', 'employee__pf_profile').order_by('employee__employee_id')
        lines = []

        # Comment header explicitly marking this as an internal reconciliation export
        lines.append(f"# INTERNAL EPFO ECR RECONCILIATION PREVIEW - {month:02d}/{year}")
        lines.append(f"# Format: UAN#~#MEMBER_NAME#~#GROSS_WAGES#~#EPF_WAGES#~#EPS_WAGES#~#EDLI_WAGES#~#EE_SHARE#~#EPS_SHARE#~#ER_SHARE#~#NCP_DAYS#~#REFUND_ADVANCES")

        for c in contribs:
            emp = c.employee
            prof = getattr(emp, 'pf_profile', None)
            uan = prof.uan_number.strip() if prof and prof.uan_number else '100000000000' # Must be 12 digits
            # Sanitize member name
            member_name = emp.full_name.replace('#~#', ' ').strip().upper()

            gross = int(round(c.earned_gross_wages or c.gross_wages))
            epf_w = int(round(c.epf_wages))
            eps_w = int(round(c.eps_wages))
            edli_w = int(round(c.edli_wages))

            ee_share = int(round(c.employee_epf))
            eps_share = int(round(c.employer_eps))
            er_share = int(round(c.employer_epf))

            ncp = int(round(c.ncp_days))
            refund = 0

            line = f"{uan}#~#{member_name}#~#{gross}#~#{epf_w}#~#{eps_w}#~#{edli_w}#~#{ee_share}#~#{eps_share}#~#{er_share}#~#{ncp}#~#{refund}"
            lines.append(line)

        return "\n".join(lines)

