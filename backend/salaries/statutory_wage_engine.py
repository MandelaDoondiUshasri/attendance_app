from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any

def round_curr(val: Decimal) -> Decimal:
    if val is None:
        return Decimal('0.00')
    if not isinstance(val, Decimal):
        val = Decimal(str(val))
    return val.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


class StatutoryWageEngine:
    """
    Statutory Wage Calculation Engine under the Code on Social Security, 2020.
    Evaluates:
    1. Included Wages: Basic Pay + Dearness Allowance (DA) + Retaining Allowance.
    2. Excluded Allowances: HRA, Conveyance Allowance, House Accommodation, Overtime, Bonus, Commissions.
    3. The 50% Rule:
       If the aggregate of excluded allowances exceeds 50% of the total remuneration (Gross Salary),
       the excess amount shall be deemed to be remuneration and added back to wages.
    4. Applicable Statutory PF & ESI Wage Ceilings.
    """

    STATUTORY_EPF_CEILING_2026 = Decimal('25000.00') # Effective 17 September 2026 under S.O. 5109(E)
    STATUTORY_PREVIOUS_CEILING = Decimal('15000.00')
    STATUTORY_ESI_CEILING = Decimal('21000.00')

    @classmethod
    def evaluate_statutory_wages(
        cls,
        gross_salary: Decimal,
        basic_salary: Decimal,
        hra: Decimal = Decimal('0.00'),
        da: Decimal = Decimal('0.00'),
        special_allowance: Decimal = Decimal('0.00'),
        conveyance: Decimal = Decimal('0.00'),
        other_allowances: Decimal = Decimal('0.00'),
        is_international_worker: bool = False,
        allow_higher_wages: bool = False,
        use_2026_ceiling: bool = True
    ) -> Dict[str, Any]:
        """
        Calculates statutory wages under the 50% allowance rule with complete transparency.
        """
        gross = round_curr(gross_salary)
        basic = round_curr(basic_salary)
        hra_amt = round_curr(hra)
        da_amt = round_curr(da)
        spec = round_curr(special_allowance)
        conv = round_curr(conveyance)
        other = round_curr(other_allowances)

        # 1. Included Components (Core Wages)
        # Section 2(88) Clause (a), (b), (c): Basic pay, Dearness allowance, Retaining allowance
        included_wages = round_curr(basic + da_amt)

        # 2. Excluded Allowances (Subject to 50% test)
        # HRA, Conveyance (up to official statutory limit), Special Allowance (if treated as allowance)
        # Note: If Special Allowance is not universally paid or linked to reimbursable costs, it is an allowance.
        excluded_allowances = round_curr(hra_amt + conv)

        # Special allowance treatment:
        # Under Supreme Court RPFC vs Vivek Mandir (2019), universally paid allowances form part of basic wages for PF.
        # However, under Code on Social Security 50% rule, all allowances count towards the 50% threshold.
        total_allowances_for_test = round_curr(hra_amt + conv + other + spec)

        # 3. 50% Threshold Check
        max_allowed_excluded = round_curr(gross * Decimal('0.50'))
        excess_allowance_adjustment = Decimal('0.00')
        rule_applied = False

        if total_allowances_for_test > max_allowed_excluded:
            excess_allowance_adjustment = round_curr(total_allowances_for_test - max_allowed_excluded)
            rule_applied = True

        # Final Statutory Wages = Included Wages + Excess Adjustment
        final_statutory_wages = round_curr(included_wages + excess_allowance_adjustment)

        # Capped PF Contribution Wages
        statutory_ceiling = cls.STATUTORY_EPF_CEILING_2026 if use_2026_ceiling else cls.STATUTORY_PREVIOUS_CEILING

        if is_international_worker or allow_higher_wages:
            pf_contribution_wages = final_statutory_wages
        else:
            pf_contribution_wages = min(final_statutory_wages, statutory_ceiling)

        # Allowance percentage of gross
        allowance_pct = round_curr((total_allowances_for_test / gross) * Decimal('100.00')) if gross > 0 else Decimal('0.00')

        # Explanation string
        if rule_applied:
            explanation = (
                f"Total allowances (₹{total_allowances_for_test}) exceed 50% of gross remuneration (₹{max_allowed_excluded}). "
                f"The excess of ₹{excess_allowance_adjustment} is added to statutory wages under the 50% rule."
            )
        else:
            explanation = (
                f"Total allowances (₹{total_allowances_for_test}) constitute {allowance_pct}% of gross remuneration "
                f"(within statutory 50% limit). Statutory wages remain ₹{included_wages}."
            )

        return {
            'gross_remuneration': float(gross),
            'included_wages': float(included_wages),
            'excluded_allowances': float(total_allowances_for_test),
            'allowance_percentage': float(allowance_pct),
            'max_allowed_allowances': float(max_allowed_excluded),
            'excess_allowance_adjustment': float(excess_allowance_adjustment),
            'final_statutory_wages': float(final_statutory_wages),
            'statutory_ceiling': float(statutory_ceiling),
            'pf_contribution_wages': float(pf_contribution_wages),
            'rule_applied': rule_applied,
            'explanation': explanation
        }

