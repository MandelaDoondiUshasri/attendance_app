"""
Comprehensive Automated Test Suite for EPFO 2026 Statutory EPF / PF & Payroll Rules.
Compliant with Gazette S.O. 5109(E) w.e.f. 17 September 2026.
Covers all 20 required scenarios from Section 13.
"""

from decimal import Decimal
from datetime import date
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import User, Role
from employees.models import Employee, Department, Designation, EmploymentStatus
from salaries.models import (
    PFConfiguration, EmployeePFProfile, PFContribution,
    Payroll, PayrollStatus, EstablishmentCategory
)
from salaries.pf_engine import (
    PFCalculationEngine, PFEligibilityEngine,
    OLD_CEILING, NEW_CEILING, TRANSITION_DATE
)
from salaries.payroll_engine import AutomatedPayrollEngine
from salaries.reports_engine import PFReportsEngine


class EPFO2026StatutoryTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Admin & HR Users
        self.ceo = User.objects.create_user(
            email='ceo_epf@example.com',
            username='ceo_epf',
            password='Password123!',
            role=Role.CEO
        )
        self.hr = User.objects.create_user(
            email='hr_epf@example.com',
            username='hr_epf',
            password='Password123!',
            role=Role.HR
        )

        # Department & Designation
        self.dept = Department.objects.create(name='Engineering', code='ENG')
        self.desg = Designation.objects.create(title='Software Engineer', department=self.dept)

        # Ensure statutory PF Configuration is present
        self.pf_config = PFConfiguration.get_active_config()

    def _create_employee(self, emp_id: str, name: str, salary: Decimal, joining_date: date, dob: date = None, uan: str = None, prev_pf: bool = False, is_iw: bool = False, higher_wage: bool = False):
        user = User.objects.create_user(
            email=f"{emp_id.lower()}@example.com",
            username=f"user_{emp_id.lower()}",
            password='Password123!',
            role=Role.EMPLOYEE
        )
        emp = Employee.objects.create(
            user=user,
            employee_id=emp_id,
            full_name=name,
            email=user.email,
            department=self.dept,
            designation=self.desg,
            joining_date=joining_date,
            dob=dob or date(1995, 5, 15),
            salary=salary,
            employment_status=EmploymentStatus.ACTIVE
        )
        profile, _ = EmployeePFProfile.objects.get_or_create(
            employee=emp,
            defaults={
                'pf_applicable': True,
                'epf_member': True,
                'eps_member': True,
                'eps_eligibility': True,
                'uan_number': uan,
                'previous_pf_membership': prev_pf,
                'international_worker': is_iw,
                'higher_wage_contribution': higher_wage,
                'basic_percentage': Decimal('100.00'), # Set 100% basic for exact direct wage tests
                'da_percentage': Decimal('0.00'),
                'hra_percentage': Decimal('0.00'),
                'special_allowance_percentage': Decimal('0.00'),
            }
        )
        profile.basic_percentage = Decimal('100.00')
        profile.da_percentage = Decimal('0.00')
        profile.hra_percentage = Decimal('0.00')
        profile.special_allowance_percentage = Decimal('0.00')
        profile.save()
        return emp

    # ── TEST 1: PF wages ₹10,000 ──────────────────────────────────────────
    def test_01_pf_wages_10000(self):
        emp = self._create_employee('E10K', 'Ten Thousand', Decimal('10000.00'), date(2026, 1, 1))
        res = PFCalculationEngine.calculate_monthly_contributions(emp, 2026, 10, payable_days=Decimal('31'), calendar_days=31)

        self.assertEqual(res['epf_wages'], Decimal('10000.00'))
        self.assertEqual(res['employee_epf'], Decimal('1200.00'))
        self.assertEqual(res['employer_eps'], Decimal('833.00')) # round(10000 * 0.0833) = 833
        self.assertEqual(res['employer_epf'], Decimal('367.00')) # 1200 - 833 = 367
        self.assertEqual(res['employer_edli'], Decimal('50.00')) # 10000 * 0.005 = 50
        self.assertEqual(res['admin_charges'], Decimal('50.00'))
        self.assertEqual(res['employee_epf'] + res['employer_epf'] + res['employer_eps'], Decimal('2400.00'))

    # ── TEST 2: PF wages ₹15,000 ──────────────────────────────────────────
    def test_02_pf_wages_15000(self):
        emp = self._create_employee('E15K', 'Fifteen Thousand', Decimal('15000.00'), date(2026, 1, 1))
        res = PFCalculationEngine.calculate_monthly_contributions(emp, 2026, 10, payable_days=Decimal('31'), calendar_days=31)

        self.assertEqual(res['epf_wages'], Decimal('15000.00'))
        self.assertEqual(res['employee_epf'], Decimal('1800.00'))
        self.assertEqual(res['employer_eps'], Decimal('1250.00')) # round(15000 * 0.0833) = 1250
        self.assertEqual(res['employer_epf'], Decimal('550.00'))  # 1800 - 1250 = 550
        self.assertEqual(res['employer_edli'], Decimal('75.00'))
        self.assertEqual(res['admin_charges'], Decimal('75.00'))

    # ── TEST 3: PF wages ₹20,000 ──────────────────────────────────────────
    def test_03_pf_wages_20000(self):
        emp = self._create_employee('E20K', 'Twenty Thousand', Decimal('20000.00'), date(2026, 1, 1))
        res = PFCalculationEngine.calculate_monthly_contributions(emp, 2026, 10, payable_days=Decimal('31'), calendar_days=31)

        self.assertEqual(res['epf_wages'], Decimal('20000.00'))
        self.assertEqual(res['employee_epf'], Decimal('2400.00'))
        self.assertEqual(res['employer_eps'], Decimal('1666.00')) # round(20000 * 0.0833) = 1666
        self.assertEqual(res['employer_epf'], Decimal('734.00'))  # 2400 - 1666 = 734
        self.assertEqual(res['employer_edli'], Decimal('100.00'))
        self.assertEqual(res['admin_charges'], Decimal('100.00'))

    # ── TEST 4: PF wages ₹25,000 ──────────────────────────────────────────
    def test_04_pf_wages_25000(self):
        emp = self._create_employee('E25K', 'Twenty Five Thousand', Decimal('25000.00'), date(2026, 1, 1))
        res = PFCalculationEngine.calculate_monthly_contributions(emp, 2026, 10, payable_days=Decimal('31'), calendar_days=31)

        self.assertEqual(res['epf_wages'], Decimal('25000.00'))
        self.assertEqual(res['employee_epf'], Decimal('3000.00'))
        self.assertEqual(res['employer_eps'], Decimal('2083.00')) # round(25000 * 0.0833) = 2083
        self.assertEqual(res['employer_epf'], Decimal('917.00'))  # 3000 - 2083 = 917
        self.assertEqual(res['employer_edli'], Decimal('125.00'))
        self.assertEqual(res['admin_charges'], Decimal('125.00'))

    # ── TEST 5: PF wages ₹35,000 with ceiling-based contributions ──────────
    def test_05_pf_wages_35000_ceiling_capped(self):
        emp = self._create_employee('E35K', 'Thirty Five Thousand', Decimal('35000.00'), date(2026, 1, 1), prev_pf=True)
        res = PFCalculationEngine.calculate_monthly_contributions(emp, 2026, 10, payable_days=Decimal('31'), calendar_days=31)

        # Must be capped at the revised ₹25,000 ceiling
        self.assertEqual(res['epf_wages'], Decimal('25000.00'))
        self.assertEqual(res['eps_wages'], Decimal('25000.00'))
        self.assertEqual(res['employee_epf'], Decimal('3000.00'))
        self.assertEqual(res['employer_eps'], Decimal('2083.00'))
        self.assertEqual(res['employer_epf'], Decimal('917.00'))
        self.assertEqual(res['employer_edli'], Decimal('125.00'))
        self.assertEqual(res['admin_charges'], Decimal('125.00'))

    # ── TEST 6: Existing PF member earning above the ceiling ───────────────
    def test_06_existing_pf_member_above_ceiling(self):
        emp = self._create_employee('E_EXIST', 'Existing Member', Decimal('40000.00'), date(2026, 10, 1), uan='101234567890', prev_pf=True)
        assessment = PFEligibilityEngine.assess_eligibility(emp, as_of_date=date(2026, 10, 1), monthly_pf_wages=Decimal('40000.00'))

        self.assertTrue(assessment['pf_applicable'])
        self.assertTrue(assessment['epf_member'])
        self.assertFalse(assessment['is_excluded'])
        self.assertEqual(assessment['scenario'], 'SCENARIO_C_EXISTING_MEMBER')

    # ── TEST 7: New employee above entry ceiling (Excluded Employee) ───────
    def test_07_new_employee_above_entry_ceiling(self):
        # Earning ₹30,000, joined in Oct 2026, never been a PF member
        emp = self._create_employee('E_NEW_HIGH', 'New High Earner', Decimal('30000.00'), date(2026, 10, 1), prev_pf=False)
        assessment = PFEligibilityEngine.assess_eligibility(emp, as_of_date=date(2026, 10, 1), monthly_pf_wages=Decimal('30000.00'))

        self.assertFalse(assessment['pf_applicable'])
        self.assertFalse(assessment['epf_member'])
        self.assertTrue(assessment['is_excluded'])
        self.assertIn('Para 2(f)(ii)', assessment['exclusion_reason'])
        self.assertEqual(assessment['scenario'], 'SCENARIO_B_EXCLUDED_EMPLOYEE')

    # ── TEST 8: Existing EPF member previously not eligible for EPS ────────
    def test_08_revised_ceiling_transition_enrolment(self):
        # Joined before 17 Sep 2026 earning ₹20,000 (was > 15,000 old ceiling), now covered w.e.f. 17 Sep 2026
        emp = self._create_employee('E_TRANS_QUAL', 'Transition Qualify', Decimal('20000.00'), date(2026, 8, 1), prev_pf=False)
        assessment = PFEligibilityEngine.assess_eligibility(emp, as_of_date=date(2026, 10, 1), monthly_pf_wages=Decimal('20000.00'))

        self.assertTrue(assessment['pf_applicable'])
        self.assertTrue(assessment['epf_member'])
        self.assertTrue(assessment['eps_member'])
        self.assertEqual(assessment['scenario'], 'SCENARIO_E_REVISED_CEILING_ENROLMENT')

    # ── TEST 9: Employee aged above 58 (EPS = 0) ───────────────────────────
    def test_09_employee_aged_above_58(self):
        # Born in 1960 -> Age in 2026 is 66 (>= 58)
        emp = self._create_employee('E_SENIOR', 'Senior Member', Decimal('20000.00'), date(2026, 1, 1), dob=date(1960, 3, 10), prev_pf=True)
        res = PFCalculationEngine.calculate_monthly_contributions(emp, 2026, 10, payable_days=Decimal('31'), calendar_days=31)

        # EPS must be 0, and full 12% goes to EPF
        self.assertEqual(res['eps_wages'], Decimal('0.00'))
        self.assertEqual(res['employer_eps'], Decimal('0.00'))
        self.assertEqual(res['employer_epf'], Decimal('2400.00')) # Full 12% (20000 * 0.12)
        self.assertEqual(res['employee_epf'], Decimal('2400.00'))

    # ── TEST 10: International Worker (No Wage Ceiling) ────────────────────
    def test_10_international_worker(self):
        # International worker earning ₹60,000
        emp = self._create_employee('E_IW', 'Global Worker', Decimal('60000.00'), date(2026, 1, 1), is_iw=True)
        res = PFCalculationEngine.calculate_monthly_contributions(emp, 2026, 10, payable_days=Decimal('31'), calendar_days=31)

        # No ₹25,000 ceiling applies under Paragraph 83
        self.assertEqual(res['epf_wages'], Decimal('60000.00'))
        self.assertEqual(res['employee_epf'], Decimal('7200.00')) # 12% of 60,000
        self.assertEqual(res['employer_eps'], Decimal('4998.00')) # 8.33% of 60,000
        self.assertEqual(res['employer_epf'], Decimal('2202.00')) # 7200 - 4998

    # ── TEST 11: Employee with Paid Leave ──────────────────────────────────
    def test_11_employee_with_paid_leave(self):
        emp = self._create_employee('E_PAID_LEAVE', 'Paid Leave Member', Decimal('20000.00'), date(2026, 1, 1))
        # 31 calendar days, employee took 3 days paid leave -> payable days = 31
        res = PFCalculationEngine.calculate_monthly_contributions(emp, 2026, 10, payable_days=Decimal('31'), calendar_days=31, lop_days=Decimal('0.00'))

        self.assertEqual(res['payable_days'], 31.0)
        self.assertEqual(res['epf_wages'], Decimal('20000.00'))
        self.assertEqual(res['employee_epf'], Decimal('2400.00'))

    # ── TEST 12: Employee with Unpaid Leave (Loss of Pay) ──────────────────
    def test_12_employee_with_unpaid_leave(self):
        emp = self._create_employee('E_LOP', 'Unpaid Leave Member', Decimal('25000.00'), date(2026, 10, 1))
        # 31 calendar days, 5 days unpaid absence -> 26 payable days
        res = PFCalculationEngine.calculate_monthly_contributions(emp, 2026, 10, payable_days=Decimal('26'), calendar_days=31, lop_days=Decimal('5.00'))

        expected_earned_wage = (Decimal('25000.00') / Decimal('31') * Decimal('26')).quantize(Decimal('0.01'))
        self.assertEqual(res['payable_days'], 26.0)
        self.assertEqual(res['ncp_days'], 5.0)
        self.assertEqual(res['epf_wages'], expected_earned_wage)
        self.assertEqual(res['employee_epf'], (expected_earned_wage * Decimal('0.12')).quantize(Decimal('1')).quantize(Decimal('0.01')))

    # ── TEST 13: Employee Joining Mid-Month ─────────────────────────────────
    def test_13_employee_joining_mid_month(self):
        # Joins on 16th October in 31-day month -> 16 payable days
        emp = self._create_employee('E_MID_JOIN', 'Mid Joiner', Decimal('25000.00'), date(2026, 10, 16))
        res = PFCalculationEngine.calculate_monthly_contributions(emp, 2026, 10, payable_days=Decimal('16'), calendar_days=31)

        expected_wage = (Decimal('25000.00') / Decimal('31') * Decimal('16')).quantize(Decimal('0.01'))
        self.assertEqual(res['epf_wages'], expected_wage)
        self.assertEqual(res['employee_epf'], (expected_wage * Decimal('0.12')).quantize(Decimal('1')).quantize(Decimal('0.01')))

    # ── TEST 14: Employee Leaving Mid-Month ────────────────────────────────
    def test_14_employee_leaving_mid_month(self):
        # Worked 10 payable days out of 30 in November
        emp = self._create_employee('E_LEAVE_MID', 'Leaving Member', Decimal('20000.00'), date(2026, 1, 1))
        res = PFCalculationEngine.calculate_monthly_contributions(emp, 2026, 11, payable_days=Decimal('10'), calendar_days=30)

        expected_wage = (Decimal('20000.00') / Decimal('30') * Decimal('10')).quantize(Decimal('0.01'))
        self.assertEqual(res['epf_wages'], expected_wage)
        self.assertEqual(res['employee_epf'], (expected_wage * Decimal('0.12')).quantize(Decimal('1')).quantize(Decimal('0.01')))

    # ── TEST 15: September 2026 Old-to-New Ceiling Transition (Critical) ──
    def test_15_september_2026_split_transition(self):
        # Salary ₹30,000, Full month (30 days) in September 2026
        # Period 1 (1-16 Sep, 16 days): Ceiling = 15,000 * 16 / 30 = 8,000.00
        # Period 2 (17-30 Sep, 14 days): Ceiling = 25,000 * 14 / 30 = 11,666.67
        # Total EPF Wage = 8,000 + 11,666.67 = 19,666.67
        emp = self._create_employee('E_SEP26', 'September Transition', Decimal('30000.00'), date(2026, 1, 1), prev_pf=True)
        res = PFCalculationEngine.calculate_monthly_contributions(emp, 2026, 9, payable_days=Decimal('30'), calendar_days=30)

        self.assertTrue(res['is_transition_month'])
        self.assertIsNotNone(res['period_1'])
        self.assertIsNotNone(res['period_2'])

        p1 = res['period_1']
        p2 = res['period_2']

        self.assertEqual(p1['prorated_ceiling'], Decimal('8000.00'))
        self.assertEqual(p2['prorated_ceiling'], Decimal('11666.67'))
        self.assertEqual(res['epf_wages'], Decimal('19666.67'))

        # Combined contributions
        # EE PF = 12% of 19666.67 = 2360.00
        self.assertEqual(res['employee_epf'], Decimal('2360.00'))
        # EPS = 8.33% of 19666.67 = 1638.00
        self.assertEqual(res['employer_eps'], Decimal('1638.00'))
        # ER EPF = 2360 - 1638 = 722.00
        self.assertEqual(res['employer_epf'], Decimal('722.00'))
        # Employer total PF == Employee total PF
        self.assertEqual(res['employer_epf'] + res['employer_eps'], res['employee_epf'])

    # ── TEST 16: October 2026 Full-Month Contribution ─────────────────────
    def test_16_october_2026_full_month_revised_ceiling(self):
        # Earning ₹30,000 in October 2026 -> Full month under revised ₹25,000 ceiling
        emp = self._create_employee('E_OCT26', 'October Full Month', Decimal('30000.00'), date(2026, 1, 1), prev_pf=True)
        res = PFCalculationEngine.calculate_monthly_contributions(emp, 2026, 10, payable_days=Decimal('31'), calendar_days=31)

        self.assertFalse(res['is_transition_month'])
        self.assertEqual(res['epf_wages'], Decimal('25000.00'))
        self.assertEqual(res['employee_epf'], Decimal('3000.00'))
        self.assertEqual(res['employer_eps'], Decimal('2083.00'))
        self.assertEqual(res['employer_epf'], Decimal('917.00'))

    # ── TEST 17: Employer PF NOT Deducted from Employee Salary ─────────────
    def test_17_employer_pf_not_deducted_from_employee_salary(self):
        emp = self._create_employee('E_TAKEHOME', 'Takehome Test', Decimal('20000.00'), date(2026, 1, 1))
        payroll_rec = AutomatedPayrollEngine.calculate_employee_payroll(emp, 2026, 10)

        gross = Decimal(payroll_rec['gross_earned_salary'])
        ee_pf = Decimal(payroll_rec['employee_pf'])
        pt = Decimal(payroll_rec['professional_tax'])
        net = Decimal(payroll_rec['net_salary'])
        er_epf = Decimal(payroll_rec['employer_epf'])
        er_eps = Decimal(payroll_rec['employer_eps'])

        esi_ee = Decimal(payroll_rec['esi_employee'])
        # Net must equal Gross minus Employee Deductions ONLY
        self.assertEqual(net, gross - ee_pf - pt - esi_ee)
        # Ensure Employer EPF and EPS are completely separate
        self.assertNotEqual(net, gross - ee_pf - er_epf - er_eps - pt - esi_ee)

    # ── TEST 18: Duplicate Payroll Prevention & Idempotency ────────────────
    def test_18_duplicate_payroll_prevention(self):
        emp = self._create_employee('E_IDEMP', 'Idempotent Test', Decimal('22000.00'), date(2026, 1, 1))
        rec1 = AutomatedPayrollEngine.calculate_employee_payroll(emp, 2026, 10)

        # Finalize and lock the payroll
        p_obj = Payroll.objects.get(id=rec1['payroll_id'])
        p_obj.status = PayrollStatus.FINALIZED
        p_obj.is_locked = True
        p_obj.save()

        # Attempt to recalculate without force_recalculate should raise ValueError
        with self.assertRaises(ValueError):
            AutomatedPayrollEngine.calculate_employee_payroll(emp, 2026, 10, force_recalculate=False)

    # ── TEST 19: Correct Contribution Rounding (Nearest Rupee) ────────────
    def test_19_correct_contribution_rounding(self):
        # Wage designed to test half-up rounding: ₹12,345
        # 12,345 * 12% = 1481.40 -> 1481.00
        # 12,345 * 8.33% = 1028.3385 -> 1028.00
        emp = self._create_employee('E_ROUND', 'Rounding Test', Decimal('12345.00'), date(2026, 1, 1))
        res = PFCalculationEngine.calculate_monthly_contributions(emp, 2026, 10, payable_days=Decimal('31'), calendar_days=31)

        self.assertEqual(res['employee_epf'], Decimal('1481.00'))
        self.assertEqual(res['employer_eps'], Decimal('1028.00'))
        self.assertEqual(res['employer_epf'], Decimal('453.00')) # 1481 - 1028 = 453.00
        self.assertEqual(res['employer_epf'] + res['employer_eps'], res['employee_epf'])

    # ── TEST 20: Payroll Reconciliation ───────────────────────────────────
    def test_20_payroll_reconciliation(self):
        emp = self._create_employee('E_RECON', 'Recon Member', Decimal('25000.00'), date(2026, 1, 1))
        AutomatedPayrollEngine.calculate_employee_payroll(emp, 2026, 10)

        recon_rep = PFReportsEngine.get_reconciliation_report(2026, 10)
        self.assertTrue(recon_rep['summary']['is_fully_reconciled'])
        self.assertEqual(recon_rep['summary']['discrepancy_count'], 0)
