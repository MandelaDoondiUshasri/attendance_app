"""
EPFO 2026 Statutory Calculation and Eligibility Engine.
Compliant with:
- Gazette Notification S.O. 5109(E) (Revised statutory wage ceiling of ₹25,000 effective 17 September 2026).
- Official EPFO FAQ and circulars regarding September 2026 split transition.
- Employees' Provident Funds Scheme, 1952.
- Employees' Pension Scheme, 1995.
- Employees' Deposit-Linked Insurance Scheme, 1976.
"""

from datetime import date
from decimal import Decimal, ROUND_HALF_UP
import calendar

from salaries.models import (
    PFConfiguration, EmployeePFProfile, PFContribution,
    PayrollComponent, EstablishmentCategory
)
from employees.models import Employee, EmploymentStatus


# Statutory transition constants
TRANSITION_DATE = date(2026, 9, 17)
OLD_CEILING = Decimal('15000.00')
NEW_CEILING = Decimal('25000.00')

# Standard rates
STD_EE_RATE = Decimal('12.00')
STD_ER_TOTAL_RATE = Decimal('12.00')
STD_ER_EPS_RATE = Decimal('8.33')
STD_ER_EPF_RATE = Decimal('3.67')
STD_ER_EDLI_RATE = Decimal('0.50')
STD_ADMIN_RATE = Decimal('0.50')
MIN_ADMIN_ACTIVE = Decimal('500.00')
MIN_ADMIN_INACTIVE = Decimal('75.00')


def round_rupee(val: Decimal) -> Decimal:
    """
    Rounds a decimal currency value to the nearest Rupee using EPFO ROUND_HALF_UP standard.
    """
    if val is None:
        return Decimal('0.00')
    return val.quantize(Decimal('1'), rounding=ROUND_HALF_UP).quantize(Decimal('0.01'))


class PFEligibilityEngine:
    """
    Evaluates and enforces statutory EPF and EPS membership eligibility.
    Considers:
    1. Monthly applicable wages.
    2. Date of joining.
    3. Existing PF membership & previous employment.
    4. UAN availability.
    5. Excluded employee criteria (Para 2(f)(ii) of EPF Scheme).
    6. Transition eligibility under Gazette S.O. 5109(E) w.e.f. 17 Sept 2026.
    7. EPS age limit (<58 years) and separate EPS membership status.
    8. International Worker status (Para 83 - uncapped).
    9. Establishment category (12% standard vs 10% qualifying).
    """

    @classmethod
    def get_or_create_pf_profile(cls, employee: Employee) -> EmployeePFProfile:
        """
        Retrieves or initializes an EmployeePFProfile with intelligent statutory defaults.
        """
        profile, created = EmployeePFProfile.objects.get_or_create(
            employee=employee,
            defaults={
                'pf_applicable': True,
                'epf_member': True,
                'eps_member': True,
                'eps_eligibility': True,
                'pf_contribution_rate': STD_EE_RATE,
                'establishment_category': EstablishmentCategory.STANDARD,
            }
        )
        if created:
            # Auto-assess initial eligibility
            assessment = cls.assess_eligibility(employee)
            profile.pf_applicable = assessment['pf_applicable']
            profile.epf_member = assessment['epf_member']
            profile.eps_member = assessment['eps_member']
            profile.eps_eligibility = assessment['eps_eligibility']
            profile.pf_exclusion_status = assessment['is_excluded']
            profile.exclusion_reason = assessment['exclusion_reason']
            profile.save()

        return profile

    @classmethod
    def assess_eligibility(cls, employee: Employee, as_of_date=None, monthly_pf_wages=None) -> dict:
        """
        Performs an exhaustive statutory PF and EPS eligibility assessment.
        """
        if as_of_date is None:
            as_of_date = date.today()

        profile = getattr(employee, 'pf_profile', None)
        joining_date = employee.joining_date or date(2026, 1, 1)

        # Determine monthly PF wages (Basic + DA + Retaining/Special)
        if monthly_pf_wages is None:
            base_sal = Decimal(str(employee.salary or Decimal('0.00')))
            if profile:
                basic_pct = Decimal(str(profile.basic_percentage or 50.00))
                da_pct = Decimal(str(profile.da_percentage or 0.00))
                monthly_pf_wages = (base_sal * (basic_pct + da_pct) / Decimal('100.00')).quantize(Decimal('0.01'))
            else:
                monthly_pf_wages = (base_sal * Decimal('0.50')).quantize(Decimal('0.01'))

        # Check existing flags from profile if present
        has_prev_membership = bool(profile.previous_pf_membership) if profile else False
        has_uan = bool(profile.uan_number and len(profile.uan_number.strip()) == 12) if profile else False
        is_international_worker = bool(profile.international_worker) if profile else False
        higher_wage_opted = bool(profile.higher_wage_contribution) if profile else False

        # Applicable wage ceiling on as_of_date
        statutory_ceiling = NEW_CEILING if as_of_date >= TRANSITION_DATE else OLD_CEILING

        # ── 1. International Worker Rule ───────────────────────────────────
        if is_international_worker:
            return {
                'pf_applicable': True,
                'epf_member': True,
                'eps_member': True,
                'eps_eligibility': True,
                'is_excluded': False,
                'exclusion_reason': '',
                'statutory_ceiling_applied': False,
                'effective_ceiling': 999999999.00,
                'rate': float(STD_EE_RATE),
                'rule_applied': 'International Worker under Paragraph 83: Mandatory coverage with no wage ceiling.',
                'scenario': 'INTERNATIONAL_WORKER'
            }

        # ── 2. Age Check for EPS (Ceases at age 58) ────────────────────────
        eps_eligible_by_age = True
        dob = employee.dob
        if dob:
            age = as_of_date.year - dob.year - ((as_of_date.month, as_of_date.day) < (dob.month, dob.day))
            if age >= 58:
                eps_eligible_by_age = False

        # ── 3. Scenario Evaluation ─────────────────────────────────────────

        # Scenario C & Existing Members: Employee has existing PF membership / UAN
        if has_prev_membership or has_uan:
            return {
                'pf_applicable': True,
                'epf_member': True,
                'eps_member': eps_eligible_by_age,
                'eps_eligibility': eps_eligible_by_age,
                'is_excluded': False,
                'exclusion_reason': '',
                'statutory_ceiling_applied': not higher_wage_opted,
                'effective_ceiling': float(statutory_ceiling) if not higher_wage_opted else 999999999.00,
                'rate': float(profile.pf_contribution_rate) if profile else float(STD_EE_RATE),
                'rule_applied': 'Existing PF member: Continuous membership preserved regardless of wage level.',
                'scenario': 'SCENARIO_C_EXISTING_MEMBER'
            }

        # Scenario A: New employee earning <= statutory ceiling at joining
        # (<= 25,000 for joining on/after 17 Sep 2026; <= 15,000 for joining before 17 Sep 2026)
        joining_ceiling = NEW_CEILING if joining_date >= TRANSITION_DATE else OLD_CEILING
        
        # Check transition qualification:
        # If joined before 17 Sep 2026 earning between 15k and 25k, employee was excluded at joining
        # but became mandatorily eligible on 17 Sep 2026 under S.O. 5109(E).
        became_eligible_at_transition = (
            joining_date < TRANSITION_DATE and
            as_of_date >= TRANSITION_DATE and
            OLD_CEILING < monthly_pf_wages <= NEW_CEILING
        )

        if became_eligible_at_transition:
            return {
                'pf_applicable': True,
                'epf_member': True,
                'eps_member': eps_eligible_by_age,
                'eps_eligibility': eps_eligible_by_age,
                'is_excluded': False,
                'exclusion_reason': '',
                'statutory_ceiling_applied': True,
                'effective_ceiling': float(NEW_CEILING),
                'rate': float(STD_EE_RATE),
                'rule_applied': 'Enrolled effective 17 September 2026 under revised statutory ceiling of ₹25,000 (S.O. 5109(E)).',
                'scenario': 'SCENARIO_E_REVISED_CEILING_ENROLMENT'
            }

        if monthly_pf_wages <= joining_ceiling:
            return {
                'pf_applicable': True,
                'epf_member': True,
                'eps_member': eps_eligible_by_age,
                'eps_eligibility': eps_eligible_by_age,
                'is_excluded': False,
                'exclusion_reason': '',
                'statutory_ceiling_applied': True,
                'effective_ceiling': float(statutory_ceiling),
                'rate': float(STD_EE_RATE),
                'rule_applied': f'Mandatory EPF & EPS coverage: Wages (₹{monthly_pf_wages}) <= Statutory Ceiling (₹{joining_ceiling}).',
                'scenario': 'SCENARIO_A_MANDATORY_NEW_EMPLOYEE'
            }

        # Scenario B: New employee earning > ceiling who has NEVER been a PF member
        # (Excluded Employee under Paragraph 2(f)(ii))
        if monthly_pf_wages > statutory_ceiling and not has_prev_membership:
            return {
                'pf_applicable': False,
                'epf_member': False,
                'eps_member': False,
                'eps_eligibility': False,
                'is_excluded': True,
                'exclusion_reason': f'Excluded Employee under Para 2(f)(ii): Wages (₹{monthly_pf_wages}) exceed statutory ceiling (₹{statutory_ceiling}) at entry.',
                'statutory_ceiling_applied': True,
                'effective_ceiling': float(statutory_ceiling),
                'rate': float(STD_EE_RATE),
                'rule_applied': 'Excluded from mandatory coverage. Voluntary enrolment requires joint declaration under Para 26(6).',
                'scenario': 'SCENARIO_B_EXCLUDED_EMPLOYEE'
            }

        # Default fallback
        return {
            'pf_applicable': True,
            'epf_member': True,
            'eps_member': eps_eligible_by_age,
            'eps_eligibility': eps_eligible_by_age,
            'is_excluded': False,
            'exclusion_reason': '',
            'statutory_ceiling_applied': True,
            'effective_ceiling': float(statutory_ceiling),
            'rate': float(STD_EE_RATE),
            'rule_applied': 'Statutory coverage applied.',
            'scenario': 'STANDARD_COVERAGE'
        }


class PFCalculationEngine:
    """
    Statutory EPF, EPS, EDLI and Administrative charge calculation engine.
    Supports:
    - Standard full wage month (Oct 2026 onwards, or prior to Sep 2026).
    - Split September 2026 transition (Period 1: 1-16 Sep @ 15k, Period 2: 17-30 Sep @ 25k).
    - Attendance integration (loss of pay, payable days, mid-month joining).
    - EPFO rounding rules (nearest rupee).
    - Strict non-deduction of employer statutory costs from employee take-home.
    """

    @classmethod
    def calculate_monthly_contributions(
        cls,
        employee: Employee,
        year: int,
        month: int,
        payable_days: Decimal = None,
        calendar_days: int = None,
        lop_days: Decimal = None,
        custom_pf_wage: Decimal = None,
        config: PFConfiguration = None
    ) -> dict:
        """
        Calculates complete statutory contributions for an employee for a given month/year.
        """
        if config is None:
            config = PFConfiguration.get_active_config(date(year, month, 1))

        profile = getattr(employee, 'pf_profile', None)
        if not profile:
            profile = PFEligibilityEngine.get_or_create_pf_profile(employee)

        # Calendar days in month
        if calendar_days is None:
            _, calendar_days = calendar.monthrange(year, month)
        cal_days_dec = Decimal(str(calendar_days))

        # Payable days (calendar days minus unpaid leaves / pre-joining)
        if payable_days is None:
            payable_days = cal_days_dec - (lop_days or Decimal('0.00'))
        payable_days = max(Decimal('0.00'), min(cal_days_dec, Decimal(str(payable_days))))

        # Monthly base salary & component breakdown
        base_salary = Decimal(str(employee.salary or Decimal('0.00')))
        basic_pct = Decimal(str(profile.basic_percentage or 50.00))
        da_pct = Decimal(str(profile.da_percentage or 0.00))
        hra_pct = Decimal(str(profile.hra_percentage or 40.00))
        special_pct = Decimal(str(profile.special_allowance_percentage or 10.00))

        # Earned gross salary based on attendance
        if payable_days >= cal_days_dec:
            earned_gross = base_salary
        else:
            earned_gross = (base_salary * payable_days / cal_days_dec).quantize(Decimal('0.01'))

        # Full-month nominal PF wages (Basic + DA + Retaining/Special)
        if custom_pf_wage is not None:
            monthly_nominal_pf_wage = Decimal(str(custom_pf_wage))
        else:
            monthly_nominal_pf_wage = (base_salary * (basic_pct + da_pct) / Decimal('100.00')).quantize(Decimal('0.01'))

        # Earned PF wages for the month
        if payable_days >= cal_days_dec:
            earned_pf_wage = monthly_nominal_pf_wage
        else:
            earned_pf_wage = (monthly_nominal_pf_wage * payable_days / cal_days_dec).quantize(Decimal('0.01'))

        # Statutory Component earned amounts
        basic_earned = (earned_gross * basic_pct / Decimal('100.00')).quantize(Decimal('0.01'))
        da_earned = (earned_gross * da_pct / Decimal('100.00')).quantize(Decimal('0.01'))
        hra_earned = (earned_gross * hra_pct / Decimal('100.00')).quantize(Decimal('0.01'))
        special_earned = (earned_gross - basic_earned - da_earned - hra_earned).quantize(Decimal('0.01'))

        # Check eligibility
        calculation_date = date(year, month, min(28, calendar_days))
        eligibility = PFEligibilityEngine.assess_eligibility(
            employee,
            as_of_date=calculation_date,
            monthly_pf_wages=monthly_nominal_pf_wage
        )

        # If employee is not PF applicable (e.g. excluded employee), return zeroed breakdown
        if not profile.pf_applicable or eligibility['is_excluded']:
            return cls._build_zero_contribution(
                employee=employee,
                year=year,
                month=month,
                calendar_days=calendar_days,
                payable_days=payable_days,
                lop_days=lop_days or Decimal('0.00'),
                earned_gross=earned_gross,
                earned_pf_wage=earned_pf_wage,
                basic_earned=basic_earned,
                da_earned=da_earned,
                hra_earned=hra_earned,
                special_earned=special_earned,
                eligibility=eligibility
            )

        # ── SEPTEMBER 2026 SPLIT TRANSITION DISPATCHER ─────────────────────
        if year == 2026 and month == 9:
            return cls._calculate_september_2026_split(
                employee=employee,
                profile=profile,
                config=config,
                base_salary=base_salary,
                monthly_nominal_pf_wage=monthly_nominal_pf_wage,
                earned_gross=earned_gross,
                payable_days=payable_days,
                calendar_days=calendar_days,
                lop_days=lop_days or Decimal('0.00'),
                basic_earned=basic_earned,
                da_earned=da_earned,
                hra_earned=hra_earned,
                special_earned=special_earned,
                eligibility=eligibility
            )

        # ── STANDARD MONTH CALCULATION (e.g. October 2026 onwards) ─────────
        statutory_ceiling = config.wage_ceiling if date(year, month, 1) >= TRANSITION_DATE else config.previous_wage_ceiling
        is_international_worker = profile.international_worker
        higher_wage_opted = profile.higher_wage_contribution

        # Proportionate wage ceiling based on payable days
        if payable_days >= cal_days_dec:
            proportionate_ceiling = statutory_ceiling
        else:
            proportionate_ceiling = (statutory_ceiling * payable_days / cal_days_dec).quantize(Decimal('0.01'))

        # Eligible EPF Wages
        if is_international_worker or higher_wage_opted:
            epf_wages = earned_pf_wage
        else:
            epf_wages = min(earned_pf_wage, proportionate_ceiling)

        # EPS & EDLI Wages (capped at statutory ceiling unless international worker)
        eps_eligible = profile.is_eps_eligible_by_age(calculation_date) and profile.eps_member
        if is_international_worker:
            eps_wages = earned_pf_wage if eps_eligible else Decimal('0.00')
            edli_wages = earned_pf_wage
        elif eps_eligible:
            eps_wages = min(earned_pf_wage, proportionate_ceiling)
            edli_wages = min(earned_pf_wage, proportionate_ceiling)
        else:
            eps_wages = Decimal('0.00')
            edli_wages = min(earned_pf_wage, proportionate_ceiling)

        # Rates
        ee_rate = Decimal(str(profile.pf_contribution_rate or config.employee_contribution_rate or STD_EE_RATE))
        er_total_rate = Decimal(str(config.employer_contribution_rate or STD_ER_TOTAL_RATE))
        eps_rate = Decimal(str(config.employer_eps_rate or STD_ER_EPS_RATE))
        edli_rate = Decimal(str(config.employer_edli_rate or STD_ER_EDLI_RATE))
        admin_rate = Decimal(str(config.admin_charge_rate or STD_ADMIN_RATE))

        # Contributions with statutory rounding
        employee_epf = round_rupee(epf_wages * (ee_rate / Decimal('100.00')))
        
        # Employer PF allocation
        if eps_eligible:
            employer_eps = round_rupee(eps_wages * (eps_rate / Decimal('100.00')))
            total_er_pf = round_rupee(epf_wages * (er_total_rate / Decimal('100.00')))
            # EPFO standard: EPF share = Total ER 12% share - EPS share
            employer_epf = max(Decimal('0.00'), total_er_pf - employer_eps)
        else:
            employer_eps = Decimal('0.00')
            employer_epf = round_rupee(epf_wages * (er_total_rate / Decimal('100.00')))

        employer_edli = round_rupee(edli_wages * (edli_rate / Decimal('100.00')))
        admin_charges = round_rupee(epf_wages * (admin_rate / Decimal('100.00')))

        total_employer_pf_liability = employer_epf + employer_eps + employer_edli + admin_charges

        return {
            'year': year,
            'month': month,
            'calendar_days': calendar_days,
            'payable_days': float(payable_days),
            'ncp_days': float(lop_days or Decimal('0.00')),
            'is_transition_month': False,

            # Earnings breakdown
            'monthly_base_salary': base_salary,
            'earned_gross_salary': earned_gross,
            'basic_earned': basic_earned,
            'da_earned': da_earned,
            'hra_earned': hra_earned,
            'special_allowance_earned': special_earned,
            'pf_gross_wages': earned_pf_wage,

            # Statutory PF wages
            'epf_wages': epf_wages,
            'eps_wages': eps_wages,
            'edli_wages': edli_wages,

            # Employee Deduction (Deducted from salary)
            'employee_epf': employee_epf,

            # Employer Contributions (NOT deducted from employee take-home)
            'employer_epf': employer_epf,
            'employer_eps': employer_eps,
            'employer_edli': employer_edli,
            'admin_charges': admin_charges,
            'total_employer_pf_liability': total_employer_pf_liability,

            # Split Transition details (zero for standard months)
            'period_1': None,
            'period_2': None,

            # Metadata & audit
            'eligibility': eligibility,
            'statutory_ceiling': statutory_ceiling,
            'is_eps_eligible': eps_eligible,
            'ee_rate': float(ee_rate),
            'establishment_category': profile.establishment_category,
        }

    @classmethod
    def _calculate_september_2026_split(
        cls,
        employee: Employee,
        profile: EmployeePFProfile,
        config: PFConfiguration,
        base_salary: Decimal,
        monthly_nominal_pf_wage: Decimal,
        earned_gross: Decimal,
        payable_days: Decimal,
        calendar_days: int,
        lop_days: Decimal,
        basic_earned: Decimal,
        da_earned: Decimal,
        hra_earned: Decimal,
        special_earned: Decimal,
        eligibility: dict
    ) -> dict:
        """
        Implements the official September 2026 two-period split transition:
        - Period 1: 1 Sep 2026 to 16 Sep 2026 (16 days). Ceiling: ₹15,000.
          Prorated ceiling: ₹15,000 * 16 / 30 = ₹8,000.00.
        - Period 2: 17 Sep 2026 to 30 Sep 2026 (14 days). Ceiling: ₹25,000.
          Prorated ceiling: ₹25,000 * 14 / 30 = ₹11,666.67.
        - Handles EPFO FAQ Scenarios 1 to 4 with proportionate allocation and single ECR format output.
        """
        total_month_days = Decimal('30.00')
        p1_total_days = Decimal('16.00')
        p2_total_days = Decimal('14.00')

        # Proportion LOP evenly across the two periods unless explicit dates are provided
        if payable_days >= total_month_days:
            p1_payable = p1_total_days
            p2_payable = p2_total_days
        else:
            p1_payable = (payable_days * (p1_total_days / total_month_days)).quantize(Decimal('0.01'))
            p2_payable = (payable_days - p1_payable).quantize(Decimal('0.01'))

        # Nominal daily PF wage
        daily_pf_wage = (monthly_nominal_pf_wage / total_month_days).quantize(Decimal('0.01'))

        p1_earned_pf = (daily_pf_wage * p1_payable).quantize(Decimal('0.01'))
        p2_earned_pf = (daily_pf_wage * p2_payable).quantize(Decimal('0.01'))
        total_earned_pf = p1_earned_pf + p2_earned_pf

        # Ceilings
        p1_ceiling = (OLD_CEILING / total_month_days * p1_payable).quantize(Decimal('0.01'))
        p2_ceiling = (NEW_CEILING / total_month_days * p2_payable).quantize(Decimal('0.01'))

        is_international_worker = profile.international_worker
        higher_wage_opted = profile.higher_wage_contribution
        eps_eligible = profile.is_eps_eligible_by_age(date(2026, 9, 30)) and profile.eps_member

        # Check if employee newly became a member on 17 Sep 2026 (EPFO FAQ Scenario 1)
        # (e.g. wages between 15k and 25k who was excluded prior to 17 Sep)
        newly_enrolled_at_transition = (
            eligibility.get('scenario') == 'SCENARIO_E_REVISED_CEILING_ENROLMENT' or
            (not profile.previous_pf_membership and OLD_CEILING < monthly_nominal_pf_wage <= NEW_CEILING)
        )

        ee_rate = Decimal(str(profile.pf_contribution_rate or config.employee_contribution_rate or STD_EE_RATE))
        er_total_rate = Decimal(str(config.employer_contribution_rate or STD_ER_TOTAL_RATE))
        eps_rate = Decimal(str(config.employer_eps_rate or STD_ER_EPS_RATE))
        edli_rate = Decimal(str(config.employer_edli_rate or STD_ER_EDLI_RATE))
        admin_rate = Decimal(str(config.admin_charge_rate or STD_ADMIN_RATE))

        # ── PERIOD 1 (1 to 16 September 2026) ──────────────────────────────
        if newly_enrolled_at_transition:
            # Employee was not a member in Period 1
            p1_epf_wages = Decimal('0.00')
            p1_eps_wages = Decimal('0.00')
            p1_edli_wages = Decimal('0.00')
            p1_ee_pf = Decimal('0.00')
            p1_er_eps = Decimal('0.00')
            p1_er_epf = Decimal('0.00')
        else:
            if is_international_worker or higher_wage_opted:
                p1_epf_wages = p1_earned_pf
            else:
                p1_epf_wages = min(p1_earned_pf, p1_ceiling)

            p1_eps_wages = min(p1_earned_pf, p1_ceiling) if eps_eligible else Decimal('0.00')
            p1_edli_wages = min(p1_earned_pf, p1_ceiling)

            p1_ee_pf = round_rupee(p1_epf_wages * (ee_rate / Decimal('100.00')))
            if eps_eligible:
                p1_er_eps = round_rupee(p1_eps_wages * (eps_rate / Decimal('100.00')))
                p1_total_er = round_rupee(p1_epf_wages * (er_total_rate / Decimal('100.00')))
                p1_er_epf = max(Decimal('0.00'), p1_total_er - p1_er_eps)
            else:
                p1_er_eps = Decimal('0.00')
                p1_er_epf = round_rupee(p1_epf_wages * (er_total_rate / Decimal('100.00')))

        # ── PERIOD 2 (17 to 30 September 2026) ─────────────────────────────
        if is_international_worker or higher_wage_opted:
            p2_epf_wages = p2_earned_pf
        else:
            p2_epf_wages = min(p2_earned_pf, p2_ceiling)

        p2_eps_wages = min(p2_earned_pf, p2_ceiling) if eps_eligible else Decimal('0.00')
        p2_edli_wages = min(p2_earned_pf, p2_ceiling)

        p2_ee_pf = round_rupee(p2_epf_wages * (ee_rate / Decimal('100.00')))
        if eps_eligible:
            p2_er_eps = round_rupee(p2_eps_wages * (eps_rate / Decimal('100.00')))
            p2_total_er = round_rupee(p2_epf_wages * (er_total_rate / Decimal('100.00')))
            p2_er_epf = max(Decimal('0.00'), p2_total_er - p2_er_eps)
        else:
            p2_er_eps = Decimal('0.00')
            p2_er_epf = round_rupee(p2_epf_wages * (er_total_rate / Decimal('100.00')))

        # ── COMBINED SEPTEMBER TOTALS (SINGLE ECR FILING) ───────────────────
        total_epf_wages = (p1_epf_wages + p2_epf_wages).quantize(Decimal('0.01'))
        total_eps_wages = (p1_eps_wages + p2_eps_wages).quantize(Decimal('0.01'))
        total_edli_wages = (p1_edli_wages + p2_edli_wages).quantize(Decimal('0.01'))

        total_ee_pf = p1_ee_pf + p2_ee_pf
        total_er_eps = p1_er_eps + p2_er_eps
        total_er_epf = p1_er_epf + p2_er_epf

        total_edli = round_rupee(total_edli_wages * (edli_rate / Decimal('100.00')))
        total_admin = round_rupee(total_epf_wages * (admin_rate / Decimal('100.00')))
        total_employer_liability = total_er_epf + total_er_eps + total_edli + total_admin

        return {
            'year': 2026,
            'month': 9,
            'calendar_days': calendar_days,
            'payable_days': float(payable_days),
            'ncp_days': float(lop_days),
            'is_transition_month': True,

            # Earnings breakdown
            'monthly_base_salary': base_salary,
            'earned_gross_salary': earned_gross,
            'basic_earned': basic_earned,
            'da_earned': da_earned,
            'hra_earned': hra_earned,
            'special_allowance_earned': special_earned,
            'pf_gross_wages': total_earned_pf,

            # Single ECR format totals
            'epf_wages': total_epf_wages,
            'eps_wages': total_eps_wages,
            'edli_wages': total_edli_wages,
            'employee_epf': total_ee_pf,
            'employer_epf': total_er_epf,
            'employer_eps': total_er_eps,
            'employer_edli': total_edli,
            'admin_charges': total_admin,
            'total_employer_pf_liability': total_employer_liability,

            # Split Period Breakdown (For Transition Report Audit Trail)
            'period_1': {
                'dates': '01/09/2026 - 16/09/2026',
                'ceiling': OLD_CEILING,
                'prorated_ceiling': p1_ceiling,
                'payable_days': float(p1_payable),
                'earned_pf_wages': p1_earned_pf,
                'epf_wages': p1_epf_wages,
                'eps_wages': p1_eps_wages,
                'employee_epf': p1_ee_pf,
                'employer_epf': p1_er_epf,
                'employer_eps': p1_er_eps,
                'is_covered': not newly_enrolled_at_transition
            },
            'period_2': {
                'dates': '17/09/2026 - 30/09/2026',
                'ceiling': NEW_CEILING,
                'prorated_ceiling': p2_ceiling,
                'payable_days': float(p2_payable),
                'earned_pf_wages': p2_earned_pf,
                'epf_wages': p2_epf_wages,
                'eps_wages': p2_eps_wages,
                'employee_epf': p2_ee_pf,
                'employer_epf': p2_er_epf,
                'employer_eps': p2_er_eps,
                'is_covered': True
            },

            'eligibility': eligibility,
            'statutory_ceiling': Decimal('19666.67'), # Prorated combined ceiling
            'is_eps_eligible': eps_eligible,
            'ee_rate': float(ee_rate),
            'establishment_category': profile.establishment_category,
        }

    @classmethod
    def _build_zero_contribution(
        cls,
        employee: Employee,
        year: int,
        month: int,
        calendar_days: int,
        payable_days: Decimal,
        lop_days: Decimal,
        earned_gross: Decimal,
        earned_pf_wage: Decimal,
        basic_earned: Decimal,
        da_earned: Decimal,
        hra_earned: Decimal,
        special_earned: Decimal,
        eligibility: dict
    ) -> dict:
        return {
            'year': year,
            'month': month,
            'calendar_days': calendar_days,
            'payable_days': float(payable_days),
            'ncp_days': float(lop_days),
            'is_transition_month': (year == 2026 and month == 9),
            'monthly_base_salary': Decimal(str(employee.salary or 0)),
            'earned_gross_salary': earned_gross,
            'basic_earned': basic_earned,
            'da_earned': da_earned,
            'hra_earned': hra_earned,
            'special_allowance_earned': special_earned,
            'pf_gross_wages': earned_pf_wage,
            'epf_wages': Decimal('0.00'),
            'eps_wages': Decimal('0.00'),
            'edli_wages': Decimal('0.00'),
            'employee_epf': Decimal('0.00'),
            'employer_epf': Decimal('0.00'),
            'employer_eps': Decimal('0.00'),
            'employer_edli': Decimal('0.00'),
            'admin_charges': Decimal('0.00'),
            'total_employer_pf_liability': Decimal('0.00'),
            'period_1': None,
            'period_2': None,
            'eligibility': eligibility,
            'statutory_ceiling': NEW_CEILING if date(year, month, 1) >= TRANSITION_DATE else OLD_CEILING,
            'is_eps_eligible': False,
            'ee_rate': float(STD_EE_RATE),
            'establishment_category': 'EXCLUDED',
        }
