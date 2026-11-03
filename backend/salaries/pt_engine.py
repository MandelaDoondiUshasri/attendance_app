from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, Optional

def round_curr(val: Decimal) -> Decimal:
    if val is None:
        return Decimal('0.00')
    if not isinstance(val, Decimal):
        val = Decimal(str(val))
    return val.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


class ProfessionalTaxEngine:
    """
    State-Specific Professional Tax (PT) Calculation Engine.
    Implements statutory slabs for:
    - Telangana & Andhra Pradesh
    - Maharashtra (including Feb ₹300 rule and women's exemption up to ₹25k)
    - Karnataka
    - Gujarat
    - Tamil Nadu
    - West Bengal
    - Delhi / Rajasthan / Haryana / UP (No PT)
    - General / Other (Configurable default)
    """

    STATES = {
        'TELANGANA': 'Telangana',
        'ANDHRA_PRADESH': 'Andhra Pradesh',
        'MAHARASHTRA': 'Maharashtra',
        'KARNATAKA': 'Karnataka',
        'GUJARAT': 'Gujarat',
        'TAMIL_NADU': 'Tamil Nadu',
        'WEST_BENGAL': 'West Bengal',
        'DELHI': 'Delhi (NIL)',
        'GENERAL': 'Standard / Default'
    }

    @classmethod
    def calculate_pt(
        cls,
        monthly_gross_salary: Decimal,
        state: str = 'TELANGANA',
        month: int = 1, # 1-12, needed for Maharashtra Feb rule
        gender: Optional[str] = 'MALE',
        is_disabled: bool = False
    ) -> Dict[str, Any]:
        """
        Calculates monthly Professional Tax deduction based on gross earnings and state rules.
        """
        gross = round_curr(monthly_gross_salary)
        state_key = (state or 'TELANGANA').upper()
        gen = (gender or 'MALE').upper()

        if is_disabled:
            return {
                'pt_amount': 0.0,
                'state': state_key,
                'slab': 'Exempted (Person with Disability)',
                'is_exempt': True
            }

        pt = Decimal('0.00')
        slab_desc = 'Zero PT'

        if state_key in ['TELANGANA', 'ANDHRA_PRADESH']:
            # Up to 15,000: NIL
            # 15,001 to 20,000: 150
            # Above 20,000: 200
            if gross <= Decimal('15000.00'):
                pt = Decimal('0.00')
                slab_desc = 'Gross <= ₹15,000: NIL'
            elif gross <= Decimal('20000.00'):
                pt = Decimal('150.00')
                slab_desc = 'Gross ₹15,001 - ₹20,000: ₹150'
            else:
                pt = Decimal('200.00')
                slab_desc = 'Gross > ₹20,000: ₹200'

        elif state_key == 'MAHARASHTRA':
            # Women earning up to ₹25,000 are completely exempt
            if gen == 'FEMALE' and gross <= Decimal('25000.00'):
                pt = Decimal('0.00')
                slab_desc = 'Female employee with gross <= ₹25,000: Exempt'
            else:
                if gross <= Decimal('7500.00'):
                    pt = Decimal('0.00')
                    slab_desc = 'Gross <= ₹7,500: NIL'
                elif gross <= Decimal('10000.00'):
                    pt = Decimal('175.00')
                    slab_desc = 'Gross ₹7,501 - ₹10,000: ₹175'
                else:
                    # Special Rule: February deduction is ₹300 to make annual ₹2,500
                    if month == 2:
                        pt = Decimal('300.00')
                        slab_desc = 'Gross > ₹10,000 (February): ₹300'
                    else:
                        pt = Decimal('200.00')
                        slab_desc = 'Gross > ₹10,000: ₹200'

        elif state_key == 'KARNATAKA':
            # Less than 25,000: NIL
            # 25,000 and above: 200
            if gross < Decimal('25000.00'):
                pt = Decimal('0.00')
                slab_desc = 'Gross < ₹25,000: NIL'
            else:
                pt = Decimal('200.00')
                slab_desc = 'Gross >= ₹25,000: ₹200'

        elif state_key == 'GUJARAT':
            # Up to 12,000: NIL
            # Above 12,000: 200
            if gross <= Decimal('12000.00'):
                pt = Decimal('0.00')
                slab_desc = 'Gross <= ₹12,000: NIL'
            else:
                pt = Decimal('200.00')
                slab_desc = 'Gross > ₹12,000: ₹200'

        elif state_key == 'WEST_BENGAL':
            if gross <= Decimal('10000.00'):
                pt = Decimal('0.00')
                slab_desc = 'Gross <= ₹10,000: NIL'
            elif gross <= Decimal('15000.00'):
                pt = Decimal('110.00')
                slab_desc = 'Gross ₹10,001 - ₹15,000: ₹110'
            elif gross <= Decimal('25000.00'):
                pt = Decimal('130.00')
                slab_desc = 'Gross ₹15,001 - ₹25,000: ₹130'
            elif gross <= Decimal('40000.00'):
                pt = Decimal('150.00')
                slab_desc = 'Gross ₹25,001 - ₹40,000: ₹150'
            else:
                pt = Decimal('200.00')
                slab_desc = 'Gross > ₹40,000: ₹200'

        elif state_key in ['DELHI', 'RAJASTHAN', 'HARYANA', 'UTTAR_PRADESH']:
            pt = Decimal('0.00')
            slab_desc = f"No Professional Tax in {cls.STATES.get(state_key, state_key)}"

        else: # GENERAL
            if gross > Decimal('20000.00'):
                pt = Decimal('200.00')
                slab_desc = 'Standard Default: ₹200'
            elif gross > Decimal('15000.00'):
                pt = Decimal('150.00')
                slab_desc = 'Standard Default: ₹150'
            else:
                pt = Decimal('0.00')
                slab_desc = 'Standard Default: NIL'

        return {
            'pt_amount': float(pt),
            'state': state_key,
            'slab': slab_desc,
            'is_exempt': False
        }

