from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, Optional

def round_curr(val: Decimal) -> Decimal:
    if val is None:
        return Decimal('0.00')
    if not isinstance(val, Decimal):
        val = Decimal(str(val))
    return val.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


class IncomeTaxTDSEngine:
    """
    Income Tax & TDS Calculation Engine for Indian Salaried Employees.
    Supports:
    - New Tax Regime (Section 115BAC - Default) with ₹75,000 standard deduction.
    - Old Tax Regime with Chapter VI-A (80C up to ₹1.5L, 80D up to ₹25k/₹50k, HRA exemption).
    - Section 87A Rebate: Zero tax for taxable income up to ₹7,00,000 in New Regime.
    - 4% Health & Education Cess.
    - Monthly TDS projection & payroll administrator override.
    """

    STANDARD_DEDUCTION_NEW_REGIME = Decimal('75000.00')
    STANDARD_DEDUCTION_OLD_REGIME = Decimal('50000.00')
    CESS_RATE = Decimal('0.04') # 4%

    @classmethod
    def calculate_tds(
        cls,
        annual_gross_salary: Decimal,
        regime: str = 'NEW_REGIME',
        declared_80c: Decimal = Decimal('0.00'),
        declared_80d: Decimal = Decimal('0.00'),
        hra_exemption: Decimal = Decimal('0.00'),
        other_deductions: Decimal = Decimal('0.00'),
        manual_monthly_tds_override: Optional[Decimal] = None
    ) -> Dict[str, Any]:
        """
        Projects annual income tax and derives monthly TDS.
        """
        if manual_monthly_tds_override is not None:
            override_val = round_curr(manual_monthly_tds_override)
            return {
                'regime': regime,
                'annual_gross': float(round_curr(annual_gross_salary)),
                'taxable_income': float(round_curr(annual_gross_salary)),
                'annual_tax': float(round_curr(override_val * Decimal('12'))),
                'monthly_tds': float(override_val),
                'is_manual_override': True,
                'breakdown': {'reason': 'Manual Administrator TDS Override'}
            }

        gross = round_curr(annual_gross_salary)
        taxable_income = Decimal('0.00')
        tax_before_cess = Decimal('0.00')

        if regime == 'NEW_REGIME':
            # Standard deduction ₹75,000
            taxable_income = max(Decimal('0.00'), gross - cls.STANDARD_DEDUCTION_NEW_REGIME)

            # Slabs (Section 115BAC Revised):
            # Up to ₹3,00,000: NIL
            # ₹3,00,001 - ₹7,00,000: 5%
            # ₹7,00,001 - ₹10,00,000: 10%
            # ₹10,00,001 - ₹12,00,000: 15%
            # ₹12,00,001 - ₹15,00,000: 20%
            # Above ₹15,00,000: 30%
            if taxable_income <= Decimal('700000.00'):
                # Section 87A rebate makes tax zero for taxable income <= ₹7,00,000
                tax_before_cess = Decimal('0.00')
            else:
                rem = taxable_income
                # Slab 1: 0 - 3L (0%)
                slab1 = min(rem, Decimal('300000.00'))
                rem -= slab1

                # Slab 2: 3L - 7L (5% of up to 4L)
                slab2 = min(rem, Decimal('400000.00'))
                tax_before_cess += slab2 * Decimal('0.05')
                rem -= slab2

                # Slab 3: 7L - 10L (10% of up to 3L)
                slab3 = min(rem, Decimal('300000.00'))
                tax_before_cess += slab3 * Decimal('0.10')
                rem -= slab3

                # Slab 4: 10L - 12L (15% of up to 2L)
                slab4 = min(rem, Decimal('200000.00'))
                tax_before_cess += slab4 * Decimal('0.15')
                rem -= slab4

                # Slab 5: 12L - 15L (20% of up to 3L)
                slab5 = min(rem, Decimal('300000.00'))
                tax_before_cess += slab5 * Decimal('0.20')
                rem -= slab5

                # Slab 6: Above 15L (30%)
                if rem > Decimal('0.00'):
                    tax_before_cess += rem * Decimal('0.30')

        else: # OLD_REGIME
            # Chapter VI-A deductions: 80C (max 1.5L), 80D (max 50k), HRA exemption, Standard deduction (50k)
            ded_80c = min(round_curr(declared_80c), Decimal('150000.00'))
            ded_80d = min(round_curr(declared_80d), Decimal('50000.00'))
            ded_hra = round_curr(hra_exemption)
            total_ded = cls.STANDARD_DEDUCTION_OLD_REGIME + ded_80c + ded_80d + ded_hra + round_curr(other_deductions)

            taxable_income = max(Decimal('0.00'), gross - total_ded)

            if taxable_income <= Decimal('500000.00'):
                # Section 87A rebate in old regime: full rebate if taxable income <= 5L
                tax_before_cess = Decimal('0.00')
            else:
                rem = taxable_income
                # 0 - 2.5L: NIL
                slab1 = min(rem, Decimal('250000.00'))
                rem -= slab1

                # 2.5L - 5L: 5% (up to 2.5L)
                slab2 = min(rem, Decimal('250000.00'))
                tax_before_cess += slab2 * Decimal('0.05')
                rem -= slab2

                # 5L - 10L: 20% (up to 5L)
                slab3 = min(rem, Decimal('500000.00'))
                tax_before_cess += slab3 * Decimal('0.20')
                rem -= slab3

                # Above 10L: 30%
                if rem > Decimal('0.00'):
                    tax_before_cess += rem * Decimal('0.30')

        # 4% Health & Education Cess
        cess = round_curr(tax_before_cess * cls.CESS_RATE)
        total_annual_tax = round_curr(tax_before_cess + cess)
        monthly_tds = round_curr(total_annual_tax / Decimal('12.00'))

        return {
            'regime': regime,
            'annual_gross': float(gross),
            'taxable_income': float(taxable_income),
            'tax_before_cess': float(tax_before_cess),
            'cess': float(cess),
            'annual_tax': float(total_annual_tax),
            'monthly_tds': float(monthly_tds),
            'is_manual_override': False,
            'breakdown': {
                'standard_deduction': float(cls.STANDARD_DEDUCTION_NEW_REGIME if regime == 'NEW_REGIME' else cls.STANDARD_DEDUCTION_OLD_REGIME),
                'rebate_87a_applied': taxable_income <= (Decimal('700000.00') if regime == 'NEW_REGIME' else Decimal('500000.00'))
            }
        }

