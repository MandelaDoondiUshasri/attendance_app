from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, Optional

def round_curr(val: Decimal) -> Decimal:
    """Rounds to 2 decimal places for financial precision."""
    if val is None:
        return Decimal('0.00')
    if not isinstance(val, Decimal):
        val = Decimal(str(val))
    return val.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

def round_rupee(val: Decimal) -> Decimal:
    """Rounds to nearest whole integer rupee per statutory convention."""
    if val is None:
        return Decimal('0.00')
    if not isinstance(val, Decimal):
        val = Decimal(str(val))
    return val.quantize(Decimal('1'), rounding=ROUND_HALF_UP).quantize(Decimal('0.01'))


class HRSalaryStructureEngine:
    """
    Flexible HR Salary Structure & Compensation Engine.
    Implements:
    1. CTC-based salary breakdown (Gross = CTC / 1.06, Basic = 50% Gross, HRA = 50% Basic, Special = remainder).
    2. Independent Statutory Toggles (Employee PF, Employer PF, PT, Employee ESI, Employer ESI, TDS).
    3. Gross-based salary breakdown.
    4. Component-wise manually defined structure.
    5. Annual salary reconciliation.
    """

    @classmethod
    def calculate_salary_breakup(
        cls,
        input_value: Decimal,
        mode: str = 'CTC_BASED',
        basic_pct: Decimal = Decimal('50.00'),
        hra_pct: Decimal = Decimal('50.00'), # 50% of Basic (i.e. 25% of Gross)
        special_allowance_pct: Optional[Decimal] = None, # None means remainder
        da_pct: Decimal = Decimal('0.00'),
        conveyance: Decimal = Decimal('0.00'),
        other_allowances: Decimal = Decimal('0.00'),
        pf_applicable: bool = True,
        employee_pf_enabled: bool = True,
        employer_pf_enabled: bool = True,
        pt_enabled: bool = True,
        employee_esi_enabled: bool = True,
        employer_esi_enabled: bool = True,
        tds_enabled: bool = True,
        pf_basis_rule: str = 'HR_BASIC', # 'HR_BASIC', 'STATUTORY_50_RULE', 'BASIC_PLUS_DA', 'GROSS_CAPPED'
        pf_rate: Decimal = Decimal('12.00'),
        pf_ceiling_capped: bool = False, # If True, caps at ₹25,000
        pt_amount: Decimal = Decimal('200.00'),
        tds_monthly: Decimal = Decimal('0.00'),
        esi_applicable: bool = True,
        tax_regime: str = 'NEW_REGIME'
    ) -> Dict[str, Any]:
        """
        Calculates all monthly and annual salary components from input_value according to
        the selected mode and independent statutory deduction toggles.
        """
        input_val = Decimal(str(input_value or '0.00'))
        basic_p = Decimal(str(basic_pct or '50.00'))
        hra_p = Decimal(str(hra_pct or '50.00')) # % of Basic
        da_p = Decimal(str(da_pct or '0.00'))
        conv = Decimal(str(conveyance or '0.00'))
        other_all = Decimal(str(other_allowances or '0.00'))
        pf_r = Decimal(str(pf_rate or '12.00')) / Decimal('100.00')

        # Synchronize backward-compatible switches with explicit toggles
        eff_ee_pf = bool(pf_applicable and employee_pf_enabled)
        eff_er_pf = bool(pf_applicable and employer_pf_enabled)
        eff_pt = bool(pt_enabled)
        eff_ee_esi = bool(esi_applicable and employee_esi_enabled)
        eff_er_esi = bool(esi_applicable and employer_esi_enabled)
        eff_tds = bool(tds_enabled)

        pt = Decimal(str(pt_amount or '0.00')) if eff_pt else Decimal('0.00')
        tds = Decimal(str(tds_monthly or '0.00')) if eff_tds else Decimal('0.00')

        monthly_gross = Decimal('0.00')
        monthly_ctc = Decimal('0.00')

        # --- STEP 1: RESOLVE GROSS SALARY ---
        if mode == 'CTC_BASED':
            monthly_ctc = input_val
            # Mathematical derivation of HR reference model:
            # CTC = Gross + Employer PF (where ER PF = 12% of Basic, Basic = 50% of Gross)
            # ER PF = 0.12 * 0.50 * Gross = 0.06 * Gross
            # CTC = 1.06 * Gross => Gross = CTC / 1.06
            if pf_ceiling_capped:
                tentative_gross = monthly_ctc / (Decimal('1.00') + (basic_p / Decimal('100.00') * pf_r))
                tentative_basic = tentative_gross * (basic_p / Decimal('100.00'))
                if tentative_basic > Decimal('25000.00'):
                    # Capped at ₹25,000 -> ER PF is fixed at 25000 * 12% = 3000
                    monthly_gross = monthly_ctc - Decimal('3000.00') - conv - other_all
                else:
                    er_pf_factor = (basic_p / Decimal('100.00')) * pf_r
                    monthly_gross = (monthly_ctc - conv - other_all) / (Decimal('1.00') + er_pf_factor)
            else:
                er_pf_factor = (basic_p / Decimal('100.00')) * pf_r # 0.50 * 0.12 = 0.06
                monthly_gross = (monthly_ctc - conv - other_all) / (Decimal('1.00') + er_pf_factor)

        elif mode == 'GROSS_BASED':
            monthly_gross = input_val

        elif mode == 'COMPONENT_WISE':
            monthly_gross = input_val

        monthly_gross = round_curr(monthly_gross)

        # --- STEP 2: EARNINGS BREAKDOWN ---
        # Basic Salary = basic_pct of Gross (default 50%)
        basic_salary = round_curr(monthly_gross * (basic_p / Decimal('100.00')))

        # DA
        da = round_curr(monthly_gross * (da_p / Decimal('100.00')))

        # HRA = hra_pct of Basic (e.g. 50% of Basic = 25% of Gross)
        hra = round_curr(basic_salary * (hra_p / Decimal('100.00')))

        # Special Allowance = Gross - Basic - DA - HRA - Conveyance - Other
        if special_allowance_pct is not None:
            special_allowance = round_curr(monthly_gross * (Decimal(str(special_allowance_pct)) / Decimal('100.00')))
        else:
            special_allowance = round_curr(monthly_gross - basic_salary - da - hra - conv - other_all)
            if special_allowance < Decimal('0.00'):
                special_allowance = Decimal('0.00')

        # Reconcile Gross to exact sum of components
        total_calculated_gross = basic_salary + da + hra + special_allowance + conv + other_all
        if total_calculated_gross != monthly_gross:
            special_allowance = round_curr(special_allowance + (monthly_gross - total_calculated_gross))

        # --- STEP 3: STATUTORY PF WAGES & DEDUCTIONS ---
        statutory_pf_wages = basic_salary
        if pf_basis_rule == 'HR_BASIC':
            statutory_pf_wages = basic_salary
        elif pf_basis_rule == 'BASIC_PLUS_DA':
            statutory_pf_wages = basic_salary + da
        elif pf_basis_rule == 'STATUTORY_50_RULE':
            total_remuneration = monthly_gross
            excluded = hra + conv
            max_allowed_excluded = total_remuneration * Decimal('0.50')
            if excluded > max_allowed_excluded:
                excess = excluded - max_allowed_excluded
                statutory_pf_wages = basic_salary + da + excess
            else:
                statutory_pf_wages = basic_salary + da
        elif pf_basis_rule == 'GROSS_CAPPED':
            statutory_pf_wages = min(monthly_gross, Decimal('25000.00'))

        if pf_ceiling_capped:
            applicable_pf_wages = min(statutory_pf_wages, Decimal('25000.00'))
        else:
            applicable_pf_wages = statutory_pf_wages

        # Employee PF (Strict zero if toggle is OFF)
        if eff_ee_pf:
            employee_pf = round_curr(applicable_pf_wages * pf_r)
        else:
            employee_pf = Decimal('0.00')

        # Employer PF (Strict zero if toggle is OFF)
        if eff_er_pf:
            employer_pf = round_curr(applicable_pf_wages * pf_r)
            eps_ceiling = Decimal('25000.00')
            eps_wages = min(applicable_pf_wages, eps_ceiling)
            employer_eps = round_curr(eps_wages * Decimal('0.0833'))
            employer_epf = round_curr(employer_pf - employer_eps)
            if employer_epf < Decimal('0.00'):
                employer_epf = Decimal('0.00')
            employer_edli = round_curr(eps_wages * Decimal('0.005'))
        else:
            employer_pf = Decimal('0.00')
            employer_eps = Decimal('0.00')
            employer_epf = Decimal('0.00')
            employer_edli = Decimal('0.00')

        # --- STEP 4: ESI CALCULATION ---
        is_esi_eligible = False
        employee_esi = Decimal('0.00')
        employer_esi = Decimal('0.00')
        if monthly_gross <= Decimal('21000.00') and monthly_gross > Decimal('0.00'):
            is_esi_eligible = True
            if eff_ee_esi:
                employee_esi = round_curr(monthly_gross * Decimal('0.0075'))
            if eff_er_esi:
                employer_esi = round_curr(monthly_gross * Decimal('0.0325'))

        # --- STEP 5: TOTAL DEDUCTIONS & NET TAKE-HOME ---
        total_employee_deductions = round_curr(employee_pf + employee_esi + pt + tds)
        net_salary = round_curr(monthly_gross - total_employee_deductions)

        # --- STEP 6: EMPLOYER SIDE CTC RECONCILIATION ---
        # Under HR Reference Model: Total CTC = Gross Salary + Employer PF (12%)
        # Employer statutory contributions are never deducted from employee net pay.
        total_employer_statutory = round_curr(employer_pf + employer_esi)
        final_monthly_ctc = round_curr(monthly_gross + employer_pf + employer_esi)

        # --- STEP 7: ANNUAL FIGURES ---
        annual_ctc = round_curr(final_monthly_ctc * Decimal('12'))
        annual_gross = round_curr(monthly_gross * Decimal('12'))
        annual_basic = round_curr(basic_salary * Decimal('12'))
        annual_hra = round_curr(hra * Decimal('12'))
        annual_special_allowance = round_curr(special_allowance * Decimal('12'))
        annual_employee_pf = round_curr(employee_pf * Decimal('12'))
        annual_employer_pf = round_curr(employer_pf * Decimal('12'))
        annual_pt = round_curr(pt * Decimal('12'))
        annual_tds = round_curr(tds * Decimal('12'))
        annual_deductions = round_curr(total_employee_deductions * Decimal('12'))
        annual_net_salary = round_curr(net_salary * Decimal('12'))

        return {
            'monthly': {
                'monthly_ctc': float(final_monthly_ctc),
                'gross_salary': float(monthly_gross),
                'basic_salary': float(basic_salary),
                'hra': float(hra),
                'special_allowance': float(special_allowance),
                'da': float(da),
                'conveyance': float(conv),
                'other_allowances': float(other_all),
                'statutory_pf_wages': float(statutory_pf_wages),
                'applicable_pf_wages': float(applicable_pf_wages),
                'employee_pf': float(employee_pf),
                'employee_esi': float(employee_esi),
                'professional_tax': float(pt),
                'income_tax_tds': float(tds),
                'total_deductions': float(total_employee_deductions),
                'net_salary': float(net_salary),
                'employer_pf': float(employer_pf),
                'employer_epf': float(employer_epf),
                'employer_eps': float(employer_eps),
                'employer_edli': float(employer_edli),
                'employer_esi': float(employer_esi),
                'total_employer_contributions': float(total_employer_statutory),
                'total_cost_to_company': float(final_monthly_ctc),
                'is_esi_eligible': is_esi_eligible,
                'tax_regime': tax_regime,
                'toggles': {
                    'employee_pf_enabled': eff_ee_pf,
                    'employer_pf_enabled': eff_er_pf,
                    'pt_enabled': eff_pt,
                    'employee_esi_enabled': eff_ee_esi,
                    'employer_esi_enabled': eff_er_esi,
                    'tds_enabled': eff_tds,
                }
            },
            'annual': {
                'annual_ctc': float(annual_ctc),
                'annual_gross': float(annual_gross),
                'annual_basic': float(annual_basic),
                'annual_hra': float(annual_hra),
                'annual_special_allowance': float(annual_special_allowance),
                'annual_employee_pf': float(annual_employee_pf),
                'annual_employer_pf': float(annual_employer_pf),
                'annual_pt': float(annual_pt),
                'annual_tds': float(annual_tds),
                'annual_deductions': float(annual_deductions),
                'annual_net_salary': float(annual_net_salary)
            },
            'ratios': {
                'basic_percentage_of_gross': float(round_curr((basic_salary / monthly_gross) * Decimal('100.00'))) if monthly_gross else 0.0,
                'hra_percentage_of_basic': float(round_curr((hra / basic_salary) * Decimal('100.00'))) if basic_salary else 0.0,
                'special_allowance_percentage_of_gross': float(round_curr((special_allowance / monthly_gross) * Decimal('100.00'))) if monthly_gross else 0.0,
                'take_home_percentage_of_ctc': float(round_curr((net_salary / final_monthly_ctc) * Decimal('100.00'))) if final_monthly_ctc else 0.0
            }
        }
