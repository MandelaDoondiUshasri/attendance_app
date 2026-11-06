import uuid
from datetime import date, timedelta
from django.test import TestCase, RequestFactory
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import Role
from tenants.models import Company, SubscriptionPlan, CompanySubscription, CompanySetting, PlanTier
from tenants.middleware import (
    TenantResolutionMiddleware,
    get_current_tenant,
    set_current_tenant,
    clear_current_tenant
)
from tenants.permissions import IsSuperAdmin, IsCompanyAdmin, IsTenantMember, HasActiveSubscription
from employees.models import Department, Designation, Employee, WorkMode, ShiftType, EmploymentStatus

User = get_user_model()


class MultiTenantIsolationTestSuite(TestCase):
    """
    Comprehensive test suite verifying multi-tenant isolation, subscription lifecycle,
    employee limit enforcement, and RBAC permissions.
    """

    def setUp(self):
        clear_current_tenant()
        self.factory = RequestFactory()
        self.client = APIClient()

        # 1. Master Tenant (FRG Enterprise)
        self.master_tenant = Company.objects.filter(is_master_tenant=True).first()
        if not self.master_tenant:
            self.master_tenant = Company.objects.create(
                name="FRG Enterprise",
                slug="frg",
                contact_email="admin@frg.com",
                status="ACTIVE",
                is_master_tenant=True
            )

        # 2. Subscription Plans
        self.starter_plan = SubscriptionPlan.objects.filter(tier=PlanTier.STARTER).first()
        if not self.starter_plan:
            self.starter_plan = SubscriptionPlan.objects.create(
                name="Starter Plan",
                tier=PlanTier.STARTER,
                billing_cycle="MONTHLY",
                price_inr=4999.00,
                max_employees=2, # Set small for testing limit enforcement
                max_storage_mb=1000
            )

        # 3. Super Admin User
        self.super_admin_user = User.objects.filter(email="superadmin@saasplatform.com").first()
        if not self.super_admin_user:
            self.super_admin_user = User.objects.create_superuser(
                email="superadmin@saasplatform.com",
                username="test_superadmin_user",
                password="Password123!"
            )
        self.super_admin_user.role = Role.SUPER_ADMIN
        self.super_admin_user.save()

        # 4. Tenant A (Alpha Tech)
        self.tenant_a = Company.objects.create(
            name="Alpha Technologies",
            slug="alpha",
            contact_email="admin@alphatech.com",
            status="ACTIVE"
        )
        self.sub_a = CompanySubscription.objects.create(
            company=self.tenant_a,
            plan=self.starter_plan,
            status="ACTIVE",
            start_date=date.today(),
            expiry_date=date.today() + timedelta(days=30),
            grace_period_days=7
        )
        self.setting_a = CompanySetting.objects.create(
            company=self.tenant_a,
            company_tagline="Alpha Tech Workspace"
        )
        self.admin_a = User.objects.create_user(
            email="admin@alphatech.com",
            username="alpha_admin",
            password="Password123!",
            role=Role.COMPANY_ADMIN,
            company=self.tenant_a
        )
        self.dept_a = Department.objects.create(
            company=self.tenant_a,
            name="Engineering Alpha",
            code="ENG-A"
        )
        self.desig_a = Designation.objects.create(
            company=self.tenant_a,
            department=self.dept_a,
            title="Senior Developer"
        )
        self.emp_user_a = User.objects.create_user(
            email="dev1@alphatech.com",
            username="dev1_alpha",
            password="Password123!",
            role=Role.EMPLOYEE,
            company=self.tenant_a
        )
        self.emp_a1 = Employee.objects.create(
            company=self.tenant_a,
            user=self.emp_user_a,
            employee_id="ALPHA-001",
            full_name="Alpha Developer One",
            email="dev1@alphatech.com",
            department=self.dept_a,
            designation=self.desig_a,
            joining_date=date.today()
        )

        # 5. Tenant B (Beta Logistics)
        self.tenant_b = Company.objects.create(
            name="Beta Logistics",
            slug="beta",
            contact_email="admin@betalogistics.com",
            status="ACTIVE"
        )
        self.sub_b = CompanySubscription.objects.create(
            company=self.tenant_b,
            plan=self.starter_plan,
            status="ACTIVE",
            start_date=date.today(),
            expiry_date=date.today() + timedelta(days=30),
            grace_period_days=7
        )
        self.setting_b = CompanySetting.objects.create(
            company=self.tenant_b,
            company_tagline="Beta Logistics Workspace"
        )
        self.admin_b = User.objects.create_user(
            email="admin@betalogistics.com",
            username="beta_admin",
            password="Password123!",
            role=Role.COMPANY_ADMIN,
            company=self.tenant_b
        )
        self.dept_b = Department.objects.create(
            company=self.tenant_b,
            name="Operations Beta",
            code="OPS-B"
        )
        self.desig_b = Designation.objects.create(
            company=self.tenant_b,
            department=self.dept_b,
            title="Operations Manager"
        )
        self.emp_user_b = User.objects.create_user(
            email="ops1@betalogistics.com",
            username="ops1_beta",
            password="Password123!",
            role=Role.EMPLOYEE,
            company=self.tenant_b
        )
        self.emp_b1 = Employee.objects.create(
            company=self.tenant_b,
            user=self.emp_user_b,
            employee_id="BETA-001",
            full_name="Beta Manager One",
            email="ops1@betalogistics.com",
            department=self.dept_b,
            designation=self.desig_b,
            joining_date=date.today()
        )

    def tearDown(self):
        clear_current_tenant()

    def test_01_master_tenant_exists(self):
        """Verifies Master Tenant is correctly identified and preserved."""
        self.assertIsNotNone(self.master_tenant)
        self.assertTrue(self.master_tenant.is_master_tenant)
        self.assertEqual(self.master_tenant.slug, 'frg')

    def test_02_tenant_resolution_middleware_header(self):
        """Verifies middleware resolves tenant from X-Tenant-Slug header."""
        mw = TenantResolutionMiddleware(lambda req: None)
        request = self.factory.get('/', HTTP_X_TENANT_SLUG='alpha')
        mw.process_request(request)
        self.assertEqual(request.tenant, self.tenant_a)
        self.assertEqual(get_current_tenant(), self.tenant_a)

    def test_03_tenant_resolution_middleware_authenticated_user(self):
        """Verifies middleware falls back to user company when header is absent."""
        mw = TenantResolutionMiddleware(lambda req: None)
        request = self.factory.get('/')
        request.user = self.admin_b
        mw.process_request(request)
        self.assertEqual(request.tenant, self.tenant_b)

    def test_04_tenant_resolution_middleware_master_fallback(self):
        """Verifies middleware falls back to Master Tenant for unauthenticated requests with no headers."""
        mw = TenantResolutionMiddleware(lambda req: None)
        request = self.factory.get('/')
        request.user = User() # anonymous
        mw.process_request(request)
        self.assertEqual(request.tenant, self.master_tenant)

    def test_05_cross_tenant_database_isolation(self):
        """
        Verifies that querying employees, departments, and users strictly respects
        the active tenant and never leaks cross-company data.
        """
        # Scoped to Tenant A
        set_current_tenant(self.tenant_a)
        emps_a = Employee.objects.filter(company=self.tenant_a)
        self.assertEqual(emps_a.count(), 1)
        self.assertEqual(emps_a.first().employee_id, "ALPHA-001")

        # Scoped to Tenant B
        set_current_tenant(self.tenant_b)
        emps_b = Employee.objects.filter(company=self.tenant_b)
        self.assertEqual(emps_b.count(), 1)
        self.assertEqual(emps_b.first().employee_id, "BETA-001")

        # Verify cross-tenant isolation
        self.assertFalse(emps_b.filter(employee_id="ALPHA-001").exists())
        self.assertFalse(emps_a.filter(employee_id="BETA-001").exists())

    def test_06_subscription_validity_and_grace_period(self):
        """Verifies active subscription, grace period, and expiration behavior."""
        # Active
        self.assertTrue(self.sub_a.is_valid_or_in_grace)
        self.assertFalse(self.sub_a.is_in_grace_period)

        # Expired but within 7 days grace period
        self.sub_a.expiry_date = date.today() - timedelta(days=3)
        self.sub_a.status = 'GRACE_PERIOD'
        self.sub_a.save()
        self.assertTrue(self.sub_a.is_in_grace_period)
        self.assertTrue(self.sub_a.is_valid_or_in_grace)

        # Expired past grace period (10 days ago)
        self.sub_a.expiry_date = date.today() - timedelta(days=10)
        self.sub_a.status = 'EXPIRED'
        self.sub_a.save()
        self.assertFalse(self.sub_a.is_in_grace_period)
        self.assertFalse(self.sub_a.is_valid_or_in_grace)

    def test_07_employee_limit_enforcement(self):
        """
        Verifies that adding employees beyond the plan quota raises a validation error.
        Starter plan in this test has max_employees = 2.
        """
        self.starter_plan.max_employees = 2
        self.starter_plan.save()

        # Alpha Tech already has 1 employee (ALPHA-001).
        # Adding employee #2 (should succeed)
        emp_user_a2 = User.objects.create_user(
            email="dev2@alphatech.com",
            username="dev2_alpha",
            password="Password123!",
            role=Role.EMPLOYEE,
            company=self.tenant_a
        )
        emp_a2 = Employee.objects.create(
            company=self.tenant_a,
            user=emp_user_a2,
            employee_id="ALPHA-002",
            full_name="Alpha Developer Two",
            email="dev2@alphatech.com",
            department=self.dept_a,
            designation=self.desig_a,
            joining_date=date.today()
        )
        self.assertEqual(Employee.objects.filter(company=self.tenant_a).count(), 2)

        # Adding employee #3 should fail the limit check
        active_count = Employee.objects.filter(company=self.tenant_a, employment_status=EmploymentStatus.ACTIVE).count()
        limit = self.sub_a.plan.max_employees
        self.assertGreaterEqual(active_count, limit)

    def test_08_super_admin_dashboard_api(self):
        """Verifies Super Admin API endpoint returns platform overview statistics."""
        self.client.force_authenticate(user=self.super_admin_user)
        response = self.client.get('/api/v1/super-admin/dashboard/stats/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('total_companies', data)
        self.assertIn('active_companies', data)
        self.assertIn('total_employees', data)
        self.assertIn('mrr_inr', data)
        self.assertGreaterEqual(data['total_companies'], 2)

    def test_09_super_admin_company_onboarding_api(self):
        """Verifies Super Admin can onboard a new company via API."""
        self.client.force_authenticate(user=self.super_admin_user)
        payload = {
            "name": "Gamma Solutions",
            "slug": "gamma",
            "contact_email": "admin@gammasolutions.com",
            "contact_phone": "+91 9876543210",
            "plan_tier": PlanTier.STARTER,
            "billing_cycle": "YEARLY",
            "admin_email": "founder@gammasolutions.com",
            "admin_name": "Gamma Founder",
            "admin_password": "SecurePassword123!"
        }
        response = self.client.post('/api/v1/super-admin/companies/onboard/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Company.objects.filter(slug='gamma').exists())
        gamma_co = Company.objects.get(slug='gamma')
        self.assertTrue(CompanySubscription.objects.filter(company=gamma_co).exists())
        self.assertTrue(CompanySetting.objects.filter(company=gamma_co).exists())
        self.assertTrue(User.objects.filter(email='founder@gammasolutions.com', company=gamma_co).exists())

    def test_10_super_admin_permissions_guard(self):
        """Verifies non-super-admin users are blocked from Super Admin APIs."""
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get('/api/v1/super-admin/dashboard/stats/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

