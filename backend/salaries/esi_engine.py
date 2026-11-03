from decimal import Decimal, ROUND_HALF_UP, ROUND_UP
from typing import Dict, Any, Optional
from datetime import date

def round_curr(val: Decimal) -> Decimal:
    if val is None:
        return Decimal('0.00')
    if not isinstance(val, Decimal):
        val = Decimal(str(val))
    return val.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

def round_esi(val: Decimal) -> Decimal:
    """ESIC convention: Rounds to next higher rupee (ROUND_UP) or nearest rupee."""
    if val is None:
        return Decimal('0.00')
    if not isinstance(val, Decimal):
        val = Decimal(str(val))
    return val.quantize(Decimal('1'), rounding=ROUND_UP).quantize(Decimal('0.01'))


class ESIEngine:
    """
    Employee State Insurance (ESIC) Calculation & Eligibility Engine.
    Implements:
    - Standard Rates: Employee 0.75%, Employer 3.25%.
    - Statutory Wage Ceiling: ₹21,000 per month (₹25,000 for Persons with Disabilities).
    - ESIC Contribution Periods (April-Sept & Oct-March) and coverage continuation rules.
    - Wage definitions for ESIC contribution (all remuneration paid/payable in cash).
    """

    STANDARD_WAGE_CEILING = Decimal('21000.00')
    PWD_WAGE_CEILING = Decimal('25000.00')
    EMPLOYEE_RATE = Decimal('0.0075') # 0.75%
    EMPLOYER_RATE = Decimal('0.0325') # 3.25%

    @classmethod
    def get_contribution_period(cls, as_of_date: Optional[date] = None) -> str:
        if as_of_date is None:
            as_of_date = date.today()
        month = as_of_date.month
        if 4 <= month <= 9:
            return f"Contribution Period 1 (1-Apr to 30-Sep {as_of_date.year})"
        elif month >= 10:
            return f"Contribution Period 2 (1-Oct {as_of_date.year} to 31-Mar {as_of_date.year + 1})"
        else:
            return f"Contribution Period 2 (1-Oct {as_of_date.year - 1} to 31-Mar {as_of_date.year})"

    @classmethod
    def calculate_esi(
        cls,
        earned_gross_wages: Decimal,
        base_monthly_gross: Optional[Decimal] = None,
        is_pwd: bool = False,
        opt_out: bool = False,
        was_covered_in_period: bool = False,
        as_of_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Determines ESI applicability and computes employee and employer contributions.
        """
        earned_gross = round_curr(earned_gross_wages)
        base_gross = round_curr(base_monthly_gross) if base_monthly_gross is not None else earned_gross
        ceiling = cls.PWD_WAGE_CEILING if is_pwd else cls.STANDARD_WAGE_CEILING
        period = cls.get_contribution_period(as_of_date)

        if opt_out or earned_gross <= Decimal('0.00'):
            return {
                'esi_applicable': False,
                'is_eligible': False,
                'esi_wages': 0.0,
                'employee_esi': 0.0,
                'employer_esi': 0.0,
                'total_esi': 0.0,
                'ceiling': float(ceiling),
                'contribution_period': period,
                'reason': 'Opted out or zero wages.'
            }

        # Statutory eligibility:
        # 1. Base monthly gross <= ceiling => Eligible.
        # 2. If already covered in the active contribution period, coverage continues even if wage crosses ceiling!
        is_eligible = (base_gross <= ceiling) or was_covered_in_period

        if not is_eligible:
            return {
                'esi_applicable': False,
                'is_eligible': False,
                'esi_wages': float(earned_gross),
                'employee_esi': 0.0,
                'employer_esi': 0.0,
                'total_esi': 0.0,
                'ceiling': float(ceiling),
                'contribution_period': period,
                'reason': f"Monthly gross wage (₹{base_gross}) exceeds statutory ceiling of ₹{ceiling}."
            }

        # ESI is calculated on actual earned gross wages
        ee_esi = round_curr(earned_gross * cls.EMPLOYEE_RATE)
        er_esi = round_curr(earned_gross * cls.EMPLOYER_RATE)
        total_esi = round_curr(ee_esi + er_esi)

        return {
            'esi_applicable': True,
            'is_eligible': True,
            'esi_wages': float(earned_gross),
            'employee_esi': float(ee_esi),
            'employer_esi': float(er_esi),
            'total_esi': float(total_esi),
            'ceiling': float(ceiling),
            'contribution_period': period,
            'reason': f"Eligible for ESIC coverage (Gross ₹{base_gross} <= ₹{ceiling} or period continuation active)."
        }

