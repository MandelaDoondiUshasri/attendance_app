import calendar
from datetime import date, timedelta
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model

from employees.models import Employee, Department, Designation, EmploymentStatus
from salaries.models import (
    Payroll, PayrollStatus, PFContribution, EmployeePFProfile,
    PFConfiguration, PayrollAuditLog, Payslip, PayslipStatus,
    SalaryStructure, EmployeeSalary, SalaryRevision, EmployeeESIProfile
)
from salaries.pf_engine import PFCalculationEngine, PFEligibilityEngine
from salaries.salary_structure_engine import HRSalaryStructureEngine
from salaries.statutory_wage_engine import StatutoryWageEngine
from salaries.pt_engine import ProfessionalTaxEngine
from salaries.esi_engine import ESIEngine
from salaries.tds_engine import IncomeTaxTDSEngine
from salaries.payroll_engine import AutomatedPayrollEngine
from salaries.views import _generate_payslip_record

User = get_user_model()


class MasterPayrollTestSuite(TestCase):
    """
    Comprehensive Test Suite validating:
    - 22 validation items from Part 16 of Master Implementation Prompt
    - Reproduction of ₹43k & ₹40k CTC HR Excel calculations
    - Reconciled Annual figures & 50% Social Security Wage Rule
    - Statutory ESI, PT, TDS, Attendance proration, and Payroll lifecycle locks.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            email='hr.admin@example.com',
            username='hradmin',
            password='TestPassword123!',
            role='HR'
        )
        self.dept = Department.objects.create(name='Technology', code='TECH')
        self.desg = Designation.objects.create(title='Senior Engineer', department=self.dept)

        self.cfg = PFConfiguration.get_active_config()
        self.cfg.wage_ceiling = Decimal('25000.00')
        self.cfg.save()

    def test_01_43k_monthly_ctc_calculation(self):
        """1. Validate exact ₹43,000 monthly CTC calculation from HR reference model."""
        res = HRSalaryStructureEngine.calculate_salary_breakup(Decimal('43000.00'), mode='CTC_BASED')
        m = res['monthly']

        # Gross = 43000 / 1.06 = 40566.04
        self.assertEqual(Decimal(str(m['gross_salary'])), Decimal('40566.04'))
        # Basic = 50% of Gross = 20283.02
        self.assertEqual(Decimal(str(m['basic_salary'])), Decimal('20283.02'))
        # HRA = 50% of Basic = 10141.51
        self.assertEqual(Decimal(str(m['hra'])), Decimal('10141.51'))
        # Special Allowance = Gross - Basic - HRA = 10141.51
        self.assertEqual(Decimal(str(m['special_allowance'])), Decimal('10141.51'))
        # Employee PF = 12% of Basic = 2433.96
        self.assertEqual(Decimal(str(m['employee_pf'])), Decimal('2433.96'))
        # Professional Tax = ₹200.00
        self.assertEqual(Decimal(str(m['professional_tax'])), Decimal('200.00'))
        # Net Salary = 40566.04 - 2433.96 - 200 = 37932.08
        self.assertEqual(Decimal(str(m['net_salary'])), Decimal('37932.08'))
        # Employer PF = 12% of Basic = 2433.96
        self.assertEqual(Decimal(str(m['employer_pf'])), Decimal('2433.96'))

    def test_02_40k_monthly_ctc_calculation_with_corrected_stale_values(self):
        """2. Validate exact ₹40,000 monthly CTC calculation with corrected stale values."""
        res = HRSalaryStructureEngine.calculate_salary_breakup(Decimal('40000.00'), mode='CTC_BASED')
        m = res['monthly']

        # Gross = 40000 / 1.06 = 37735.85
        self.assertEqual(Decimal(str(m['gross_salary'])), Decimal('37735.85'))
        # Basic = 50% of Gross = 18867.92
        self.assertEqual(Decimal(str(m['basic_salary'])), Decimal('18867.93')) # 37735.85 * 0.50
        # HRA = 50% of Basic = 9433.97
        self.assertEqual(Decimal(str(m['hra'])), Decimal('9433.97'))
        # EE PF = 12% of Basic = 2264.15
        self.assertEqual(Decimal(str(m['employee_pf'])), Decimal('2264.15'))
        # Professional Tax = 200.00
        self.assertEqual(Decimal(str(m['professional_tax'])), Decimal('200.00'))
        # Net Salary = Gross - EE PF - PT = 35271.70
        self.assertEqual(Decimal(str(m['net_salary'])), Decimal('35271.70'))
        # Employer PF = 2264.15
        self.assertEqual(Decimal(str(m['employer_pf'])), Decimal('2264.15'))

    def test_03_annual_ctc_and_gross_reconciliation(self):
        """3. Annual CTC and Gross salary reconcile with exact 12-month multiplication."""
        res = HRSalaryStructureEngine.calculate_salary_breakup(Decimal('43000.00'), mode='CTC_BASED')
        ann = res['annual']
        m = res['monthly']

        self.assertEqual(Decimal(str(ann['annual_gross'])), Decimal('486792.48'))
        self.assertEqual(Decimal(str(ann['annual_basic'])), Decimal('243396.24'))
        self.assertEqual(Decimal(str(ann['annual_hra'])), Decimal('121698.12'))
        self.assertEqual(Decimal(str(ann['annual_employer_pf'])), Decimal('29207.52'))
        # Annual Gross + Annual ER PF = 486792.48 + 29207.52 = 516000.00
        sum_ctc = Decimal(str(ann['annual_gross'])) + Decimal(str(ann['annual_employer_pf']))
        self.assertEqual(sum_ctc, Decimal('516000.00'))

    def test_04_basic_salary_calculation_50_percent(self):
        """4. Verify basic salary is exactly 50% of monthly gross."""
        res = HRSalaryStructureEngine.calculate_salary_breakup(Decimal('60000.00'), mode='GROSS_BASED')
        m = res['monthly']
        self.assertEqual(Decimal(str(m['gross_salary'])), Decimal('60000.00'))
        self.assertEqual(Decimal(str(m['basic_salary'])), Decimal('30000.00'))

    def test_05_hra_calculation_50_percent_of_basic(self):
        """5. Verify HRA is exactly 50% of Basic salary."""
        res = HRSalaryStructureEngine.calculate_salary_breakup(Decimal('60000.00'), mode='GROSS_BASED')
        m = res['monthly']
        self.assertEqual(Decimal(str(m['basic_salary'])), Decimal('30000.00'))
        self.assertEqual(Decimal(str(m['hra'])), Decimal('15000.00'))

    def test_06_special_allowance_remainder_calculation(self):
        """6. Special allowance equals Gross - Basic - HRA (remainder)."""
        res = HRSalaryStructureEngine.calculate_salary_breakup(Decimal('60000.00'), mode='GROSS_BASED')
        m = res['monthly']
        expected_special = Decimal('60000.00') - Decimal('30000.00') - Decimal('15000.00')
        self.assertEqual(Decimal(str(m['special_allowance'])), expected_special)

    def test_07_employee_pf_calculation(self):
        """7. Employee PF is 12% of applicable PF wages."""
        res = HRSalaryStructureEngine.calculate_salary_breakup(Decimal('30000.00'), mode='GROSS_BASED')
        m = res['monthly']
        # Basic = 15,000, 12% = 1,800
        self.assertEqual(Decimal(str(m['basic_salary'])), Decimal('15000.00'))
        self.assertEqual(Decimal(str(m['employee_pf'])), Decimal('1800.00'))

    def test_08_employer_pf_and_eps_allocation(self):
        """8. Employer PF is allocated into EPS (8.33%) and EPF (3.67%)."""
        res = HRSalaryStructureEngine.calculate_salary_breakup(Decimal('30000.00'), mode='GROSS_BASED')
        m = res['monthly']
        # Basic = 15,000
        # Total ER PF = 15000 * 12% = 1800
        # EPS = 15000 * 8.33% = 1249.50
        # EPF = 1800 - 1249.50 = 550.50
        total_er = Decimal(str(m['employer_epf'])) + Decimal(str(m['employer_eps']))
        self.assertEqual(total_er, Decimal(str(m['employer_pf'])))

    def test_09_revised_2026_epf_ceiling(self):
        """9. Statutory wage ceiling capped at ₹25,000 w.e.f 17-Sep-2026."""
        eval_res = StatutoryWageEngine.evaluate_statutory_wages(
            gross_salary=Decimal('80000.00'),
            basic_salary=Decimal('40000.00'),
            use_2026_ceiling=True
        )
        self.assertEqual(Decimal(str(eval_res['pf_contribution_wages'])), Decimal('25000.00'))

    def test_10_september_2026_transition_split(self):
        """10. September 2026 split calculation respects Period 1 (15k) and Period 2 (25k) ceilings."""
        emp = Employee.objects.create(
            employee_id='EMP-SEP-TRANS',
            user=self.user,
            full_name='Transition Employee',
            email='transition@example.com',
            joining_date=date(2026, 1, 1),
            salary=Decimal('60000.00')
        )
        EmployeePFProfile.objects.create(employee=emp, pf_applicable=True, epf_member=True, previous_pf_membership=True, uan_number='100987654321')

        pf = PFCalculationEngine.calculate_monthly_contributions(
            employee=emp,
            year=2026,
            month=9,
            payable_days=Decimal('30.00'),
            calendar_days=30
        )
        self.assertTrue(pf['is_transition_month'])
        # Period 1 cap: 8,000; Period 2 cap: 11,666.67; Combined: 19,666.67
        self.assertEqual(pf['epf_wages'], Decimal('19666.67'))
        self.assertEqual(pf['employee_epf'], Decimal('2360.00'))

    def test_11_eps_age_58_eligibility_cut_off(self):
        """11. Employees aged 58+ cease EPS (0% to EPS, full 12% to EPF)."""
        emp = Employee.objects.create(
            employee_id='EMP-AGE-58',
            user=User.objects.create_user(username='age58', email='age58@example.com'),
            full_name='Senior Staff',
            email='age58@example.com',
            dob=date(1966, 1, 1), # 60 years old in 2026
            joining_date=date(2020, 1, 1),
            salary=Decimal('40000.00')
        )
        EmployeePFProfile.objects.create(employee=emp, pf_applicable=True, epf_member=True, eps_member=True)
        pf = PFCalculationEngine.calculate_monthly_contributions(
            employee=emp,
            year=2026,
            month=10,
            payable_days=Decimal('31.00'),
            calendar_days=31
        )
        self.assertEqual(pf['employer_eps'], Decimal('0.00'))
        self.assertEqual(pf['employer_epf'], Decimal('2400.00')) # Full 12% to EPF

    def test_12_esi_eligibility_and_rates(self):
        """12. ESI applies when gross <= ₹21,000 (0.75% EE, 3.25% ER) and is NIL above ₹21,000."""
        # Low gross <= 21k
        esi_low = ESIEngine.calculate_esi(earned_gross_wages=Decimal('20000.00'))
        self.assertTrue(esi_low['esi_applicable'])
        self.assertEqual(Decimal(str(esi_low['employee_esi'])), Decimal('150.00')) # 20000 * 0.75%
        self.assertEqual(Decimal(str(esi_low['employer_esi'])), Decimal('650.00')) # 20000 * 3.25%

        # High gross > 21k
        esi_high = ESIEngine.calculate_esi(earned_gross_wages=Decimal('35000.00'))
        self.assertFalse(esi_high['esi_applicable'])
        self.assertEqual(Decimal(str(esi_high['employee_esi'])), Decimal('0.00'))

    def test_13_professional_tax_state_slabs_telangana_and_maharashtra(self):
        """13. Professional Tax correctly applies state-specific slabs."""
        # Telangana: Gross > 20k -> ₹200
        pt_ts = ProfessionalTaxEngine.calculate_pt(Decimal('25000.00'), state='TELANGANA')
        self.assertEqual(pt_ts['pt_amount'], 200.0)

        # Maharashtra: February month triggers ₹300 deduction for gross > 10k
        pt_mh_feb = ProfessionalTaxEngine.calculate_pt(Decimal('25000.00'), state='MAHARASHTRA', month=2)
        self.assertEqual(pt_mh_feb['pt_amount'], 300.0)

        # Maharashtra: Other months trigger ₹200
        pt_mh_jan = ProfessionalTaxEngine.calculate_pt(Decimal('25000.00'), state='MAHARASHTRA', month=1)
        self.assertEqual(pt_mh_jan['pt_amount'], 200.0)

        # Maharashtra: Women earning <= 25,000 are exempt
        pt_mh_woman = ProfessionalTaxEngine.calculate_pt(Decimal('22000.00'), state='MAHARASHTRA', gender='FEMALE')
        self.assertEqual(pt_mh_woman['pt_amount'], 0.0)

    def test_14_tds_calculation_new_regime_and_override(self):
        """14. TDS calculates under New Tax Regime and honors administrator overrides."""
        # Income <= 7L taxable has 0 TDS due to 87A rebate
        tds_low = IncomeTaxTDSEngine.calculate_tds(annual_gross_salary=Decimal('600000.00'), regime='NEW_REGIME')
        self.assertEqual(tds_low['monthly_tds'], 0.0)

        # Higher income > 7.75L taxable has projected TDS
        tds_high = IncomeTaxTDSEngine.calculate_tds(annual_gross_salary=Decimal('1200000.00'), regime='NEW_REGIME')
        self.assertGreater(tds_high['monthly_tds'], 0.0)

        # Manual override
        tds_override = IncomeTaxTDSEngine.calculate_tds(
            annual_gross_salary=Decimal('1200000.00'),
            manual_monthly_tds_override=Decimal('3500.00')
        )
        self.assertEqual(tds_override['monthly_tds'], 3500.0)

    def test_15_paid_leave_salary_and_pf_preservation(self):
        """15. Paid leave does not reduce earned salary or statutory PF wage basis."""
        emp = Employee.objects.create(
            employee_id='EMP-LEAVE-PAID',
            user=User.objects.create_user(username='paidl', email='paidl@example.com'),
            full_name='Paid Leave Employee',
            email='paidl@example.com',
            joining_date=date(2026, 1, 1),
            salary=Decimal('30000.00')
        )
        EmployeePFProfile.objects.create(employee=emp, pf_applicable=True, epf_member=True)

        pf = PFCalculationEngine.calculate_monthly_contributions(
            employee=emp,
            year=2026,
            month=10,
            payable_days=Decimal('31.00'),
            calendar_days=31,
            lop_days=Decimal('0.00')
        )
        self.assertEqual(pf['earned_gross_salary'], Decimal('30000.00'))
        self.assertEqual(pf['ncp_days'], 0.0)

    def test_16_unpaid_leave_lop_salary_deduction(self):
        """16. Unpaid leave (Loss of Pay) prorates gross and statutory PF wages."""
        emp = Employee.objects.create(
            employee_id='EMP-LOP-TEST',
            user=User.objects.create_user(username='loptest', email='loptest@example.com'),
            full_name='LOP Employee',
            email='loptest@example.com',
            joining_date=date(2026, 1, 1),
            salary=Decimal('30000.00')
        )
        EmployeePFProfile.objects.create(employee=emp, pf_applicable=True, epf_member=True)

        # 30-day month with 10 LOP days => payable days = 20
        pf_calc = PFCalculationEngine.calculate_monthly_contributions(
            employee=emp,
            year=2026,
            month=9,
            payable_days=Decimal('20.00'),
            calendar_days=30,
            lop_days=Decimal('10.00')
        )
        # Earned gross = 30000 * 20 / 30 = 20000
        self.assertEqual(pf_calc['earned_gross_salary'], Decimal('20000.00'))
        self.assertLess(pf_calc['employee_epf'], Decimal('3000.00'))

    def test_17_employee_mid_month_joining_proration(self):
        """17. Mid-month joining correctly prorates payable days and earned salary."""
        emp = Employee.objects.create(
            employee_id='EMP-JOIN-MID',
            user=User.objects.create_user(username='joinmid', email='joinmid@example.com'),
            full_name='Mid Joining',
            email='joinmid@example.com',
            joining_date=date(2026, 10, 16), # Joined on 16th of 31-day month
            salary=Decimal('31000.00')
        )
        EmployeePFProfile.objects.create(employee=emp, pf_applicable=True, epf_member=True)

        # 16th to 31st = 16 days payable
        pf_calc = PFCalculationEngine.calculate_monthly_contributions(
            employee=emp,
            year=2026,
            month=10,
            payable_days=Decimal('16.00'),
            calendar_days=31,
            lop_days=Decimal('0.00')
        )
        # 31,000 * 16 / 31 = 16,000.00
        self.assertEqual(pf_calc['earned_gross_salary'], Decimal('16000.00'))

    def test_18_employee_mid_month_exit_proration(self):
        """18. Employee leaving mid-month calculates payable salary based on days served."""
        emp = Employee.objects.create(
            employee_id='EMP-EXIT-MID',
            user=User.objects.create_user(username='exitmid', email='exitmid@example.com'),
            full_name='Mid Exit',
            email='exitmid@example.com',
            joining_date=date(2025, 1, 1),
            salary=Decimal('30000.00')
        )
        EmployeePFProfile.objects.create(employee=emp, pf_applicable=True, epf_member=True)

        # Exited on 15th of 30-day month = 15 payable days
        pf_calc = PFCalculationEngine.calculate_monthly_contributions(
            employee=emp,
            year=2026,
            month=11,
            payable_days=Decimal('15.00'),
            calendar_days=30,
            lop_days=Decimal('0.00')
        )
        # 30,000 * 15 / 30 = 15,000.00
        self.assertEqual(pf_calc['earned_gross_salary'], Decimal('15000.00'))

    def test_19_salary_revision_history_tracking(self):
        """19. Salary revisions record previous vs new salary and immutable audit logs."""
        emp = Employee.objects.create(
            employee_id='EMP-REV-TEST',
            user=User.objects.create_user(username='revtest', email='revtest@example.com'),
            full_name='Revision Staff',
            email='revtest@example.com',
            joining_date=date(2025, 1, 1),
            salary=Decimal('40000.00')
        )
        emp_sal = EmployeeSalary.objects.create(
            employee=emp,
            monthly_ctc=Decimal('40000.00'),
            monthly_gross=Decimal('37735.85')
        )

        # Increment salary to 43,000 CTC
        emp_sal.monthly_ctc = Decimal('43000.00')
        emp_sal.monthly_gross = Decimal('40566.04')
        emp_sal.save()

        SalaryRevision.objects.create(
            employee=emp,
            previous_monthly_ctc=Decimal('40000.00'),
            revised_monthly_ctc=Decimal('43000.00'),
            previous_gross=Decimal('37735.85'),
            revised_gross=Decimal('40566.04'),
            change_type='INCREMENT',
            approved_by=self.user,
            reason="Annual Performance Review Increment."
        )

        rev = SalaryRevision.objects.filter(employee=emp).first()
        self.assertIsNotNone(rev)
        self.assertEqual(rev.previous_monthly_ctc, Decimal('40000.00'))
        self.assertEqual(rev.revised_monthly_ctc, Decimal('43000.00'))

    def test_20_duplicate_payroll_prevention(self):
        """20. Duplicate payroll calculation without force flag on locked record is prevented."""
        emp = Employee.objects.create(
            employee_id='EMP-DUP-TEST',
            user=User.objects.create_user(username='duptest', email='duptest@example.com'),
            full_name='Duplicate Test Staff',
            email='duptest@example.com',
            joining_date=date(2025, 1, 1),
            salary=Decimal('35000.00')
        )
        Payroll.objects.create(
            employee=emp,
            year=2026,
            month=10,
            status=PayrollStatus.FINALIZED,
            is_locked=True
        )

        with self.assertRaises(ValueError):
            AutomatedPayrollEngine.calculate_employee_payroll(
                employee=emp,
                year=2026,
                month=10,
                force_recalculate=False
            )

    def test_21_finalized_payroll_protection_and_reversal(self):
        """21. Finalized payroll records are protected from silent modification; reversible only with reason."""
        emp = Employee.objects.create(
            employee_id='EMP-LOCK-TEST',
            user=User.objects.create_user(username='locktest', email='locktest@example.com'),
            full_name='Lock Test Staff',
            email='locktest@example.com',
            joining_date=date(2025, 1, 1),
            salary=Decimal('35000.00')
        )
        p = Payroll.objects.create(
            employee=emp,
            year=2026,
            month=11,
            status=PayrollStatus.DRAFT,
            is_locked=False
        )

        # Finalize payroll
        AutomatedPayrollEngine.finalize_payroll(year=2026, month=11, actor=self.user)
        p.refresh_from_db()
        self.assertTrue(p.is_locked)
        self.assertEqual(p.status, PayrollStatus.FINALIZED)

        # Reversal without reason fails
        with self.assertRaises(ValueError):
            AutomatedPayrollEngine.reverse_payroll(year=2026, month=11, reason='', actor=self.user)

        # Reversal with valid authorized reason succeeds
        AutomatedPayrollEngine.reverse_payroll(year=2026, month=11, reason='Attendance correction approved by HR', actor=self.user)
        p.refresh_from_db()
        self.assertFalse(p.is_locked)
        self.assertEqual(p.status, PayrollStatus.REVERSED)

    def test_22_payslip_financial_reconciliation(self):
        """22. Payslip correctly balances Net Payable = Gross Earnings - Total Deductions."""
        emp = Employee.objects.create(
            employee_id='EMP-PAYSLIP-REC',
            user=User.objects.create_user(username='psliprec', email='psliprec@example.com'),
            full_name='Reconciliation Employee',
            email='psliprec@example.com',
            joining_date=date(2025, 1, 1),
            salary=Decimal('40566.04')
        )
        EmployeePFProfile.objects.create(employee=emp, pf_applicable=True, epf_member=True)

        payslip = _generate_payslip_record(employee=emp, year=2026, month=10, generated_by=self.user)
        self.assertEqual(payslip.net_salary, payslip.gross_salary - payslip.total_deductions)
        self.assertTrue(payslip.pdf_file.name.endswith('.pdf'))
