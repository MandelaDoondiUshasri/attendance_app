from datetime import date
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import Role
from tenants.models import Company, SubscriptionPlan, CompanySubscription, PlanTier
from tenants.middleware import clear_current_tenant
from employees.models import Department, Designation, Employee
from reports.services import MonthlyAttendanceSalaryEngine

User = get_user_model()


class ReportsMultiTenantTestSuite(TestCase):
    """
    Ensures Monthly Reports calculate properly without 500 errors,
    honors multi-tenant isolation, and handles empty datasets safely.
    """

    def setUp(self):
        clear_current_tenant()
        self.client = APIClient()

        # 1. Plan
        self.plan = SubscriptionPlan.objects.filter(tier=PlanTier.ENTERPRISE).first()
        if not self.plan:
            self.plan = SubscriptionPlan.objects.create(
                tier=PlanTier.ENTERPRISE,
                name="Enterprise Plan",
                billing_cycle="MONTHLY",
                price_inr=9999.00,
                max_employees=50,
                max_storage_mb=5000,
            )

        # 2. FRG Enterprise Tenant (fetch or create)
        self.frg = Company.objects.filter(is_master_tenant=True).first() or Company.objects.filter(slug="frg").first()
        if not self.frg:
            self.frg = Company.objects.create(
                name="Fortune Rise Group",
                slug="frg",
                contact_email="admin@frg.com",
                status="ACTIVE",
                is_master_tenant=True
            )
        CompanySubscription.objects.get_or_create(
            company=self.frg,
            defaults={
                "plan": self.plan,
                "status": "ACTIVE",
                "start_date": date.today(),
                "expiry_date": date(2028, 1, 1)
            }
        )

        # 3. First Care Pharmacy Tenant
        self.fcp, _ = Company.objects.get_or_create(
            slug="firstcare_test",
            defaults={
                "name": "First Care Pharmacy",
                "contact_email": "admin@firstcare.com",
                "status": "ACTIVE",
                "is_master_tenant": False
            }
        )
        CompanySubscription.objects.get_or_create(
            company=self.fcp,
            defaults={
                "plan": self.plan,
                "status": "ACTIVE",
                "start_date": date.today(),
                "expiry_date": date(2028, 1, 1)
            }
        )

        # 4. Users
        self.frg_ceo = User.objects.filter(username="frg_ceo_test").first()
        if not self.frg_ceo:
            self.frg_ceo = User.objects.create_user(
                email="ceo@frgtest.com",
                username="frg_ceo_test",
                password="Password123!",
                role=Role.CEO,
                company=self.frg
            )

        self.fcp_ceo = User.objects.filter(username="fcp_ceo_test").first()
        if not self.fcp_ceo:
            self.fcp_ceo = User.objects.create_user(
                email="ceo@firstcaretest.com",
                username="fcp_ceo_test",
                password="Password123!",
                role=Role.CEO,
                company=self.fcp
            )

        self.superadmin = User.objects.filter(username="attendx_superadmin_test").first()
        if not self.superadmin:
            self.superadmin = User.objects.create_superuser(
                email="superadmin@attendxtest.com",
                username="attendx_superadmin_test",
                password="Password123!",
                role=Role.SUPER_ADMIN
            )

        # 5. Employees in FRG
        self.dept_frg, _ = Department.objects.get_or_create(company=self.frg, name="Tech", defaults={"code": "TC"})
        self.desig_frg, _ = Designation.objects.get_or_create(company=self.frg, department=self.dept_frg, title="Engineer")
        self.emp_frg_user = User.objects.filter(username="emp1_frg_test").first()
        if not self.emp_frg_user:
            self.emp_frg_user = User.objects.create_user(
                email="emp1@frgtest.com",
                username="emp1_frg_test",
                password="Password123!",
                role=Role.EMPLOYEE,
                company=self.frg
            )
        self.emp_frg, _ = Employee.objects.get_or_create(
            employee_id="FRG-001",
            defaults={
                "company": self.frg,
                "user": self.emp_frg_user,
                "full_name": "FRG Employee One",
                "email": "emp1@frgtest.com",
                "department": self.dept_frg,
                "designation": self.desig_frg,
                "joining_date": date(2026, 1, 1)
            }
        )

        # 6. Employees in First Care Pharmacy
        self.dept_fcp, _ = Department.objects.get_or_create(company=self.fcp, name="Pharmacy Ops", defaults={"code": "PH"})
        self.desig_fcp, _ = Designation.objects.get_or_create(company=self.fcp, department=self.dept_fcp, title="Pharmacist")
        self.emp_fcp_user = User.objects.filter(username="pharm1_fcp_test").first()
        if not self.emp_fcp_user:
            self.emp_fcp_user = User.objects.create_user(
                email="pharm1@firstcaretest.com",
                username="pharm1_fcp_test",
                password="Password123!",
                role=Role.EMPLOYEE,
                company=self.fcp
            )
        self.emp_fcp, _ = Employee.objects.get_or_create(
            employee_id="FCP-001",
            defaults={
                "company": self.fcp,
                "user": self.emp_fcp_user,
                "full_name": "Pharmacy Staff One",
                "email": "pharm1@firstcaretest.com",
                "department": self.dept_fcp,
                "designation": self.desig_fcp,
                "joining_date": date(2026, 1, 1)
            }
        )

    def test_engine_month_calendar_info(self):
        """Calendar calculation should never crash and return valid metadata."""
        cal = MonthlyAttendanceSalaryEngine.get_month_calendar_info(2026, 11)
        self.assertEqual(cal['total_calendar_days'], 30)
        self.assertIn('sundays', cal)
        self.assertIn('company_working_days', cal)

    def test_fcp_monthly_report_does_not_leak_frg_employees(self):
        """First Care Pharmacy CEO must only see FCP employees, never FRG employees."""
        self.client.force_authenticate(user=self.fcp_ceo)
        response = self.client.get('/api/v1/reports/monthly-report/?year=2026&month=11')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        emp_ids = [e['employee_id'] for e in response.data.get('employees', [])]
        self.assertIn('FCP-001', emp_ids)
        self.assertNotIn('FRG-001', emp_ids)

    def test_frg_monthly_report_does_not_leak_fcp_employees(self):
        """FRG CEO must only see FRG employees, never FCP employees."""
        self.client.force_authenticate(user=self.frg_ceo)
        response = self.client.get('/api/v1/reports/monthly-report/?year=2026&month=11')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        emp_ids = [e['employee_id'] for e in response.data.get('employees', [])]
        self.assertIn('FRG-001', emp_ids)
        self.assertNotIn('FCP-001', emp_ids)

    def test_superadmin_can_access_report(self):
        """Super Admin can access monthly report without 403 or 500 error."""
        self.client.force_authenticate(user=self.superadmin)
        response = self.client.get('/api/v1/reports/monthly-report/?year=2026&month=11')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
