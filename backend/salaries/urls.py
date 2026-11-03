from django.urls import path, include
from rest_framework.routers import DefaultRouter
from salaries.views import (
    SalaryViewSet, SalaryHistoryViewSet,
    IncrementSalaryView, DecrementSalaryView,
    PayrollCalculationView,
    PayslipManagementViewSet,
    EmployeePayslipViewSet,
    PFConfigurationView,
    EmployeePFProfileViewSet,
    PFEligibilityAssessmentView,
    PFDashboardView,
    PayrollProcessView,
    PFReportsView,
    SalaryStructureViewSet,
    CTCCalculatorView,
    EmployeeSalaryViewSet,
    SalaryRevisionViewSet,
    EmployeeESIProfileViewSet,
    PayrollWorkflowView
)

router = DefaultRouter()
router.register('structures', SalaryStructureViewSet, basename='salary-structures')
router.register('employee-salaries', EmployeeSalaryViewSet, basename='employee-salaries')
router.register('salary-revisions', SalaryRevisionViewSet, basename='salary-revisions')
router.register('esi/profiles', EmployeeESIProfileViewSet, basename='esi-profiles')
router.register('pf/profiles', EmployeePFProfileViewSet, basename='pf-profiles')
router.register('payslips', PayslipManagementViewSet, basename='payslip-management')
router.register('my-payslips', EmployeePayslipViewSet, basename='my-payslips')
router.register('history', SalaryHistoryViewSet, basename='salary-history')
router.register('', SalaryViewSet, basename='salary')

urlpatterns = [
    # 2026 Statutory EPF / PF & Payroll Endpoints
    path('pf/config/', PFConfigurationView.as_view(), name='pf_config'),
    path('pf/eligibility/', PFEligibilityAssessmentView.as_view(), name='pf_eligibility'),
    path('pf/dashboard/', PFDashboardView.as_view(), name='pf_dashboard'),
    path('pf/process/', PayrollProcessView.as_view(), name='pf_payroll_process'),
    path('pf/reports/', PFReportsView.as_view(), name='pf_reports'),

    # Interactive CTC-to-In-Hand Calculator & Payroll Lifecycle Workflow
    path('calculator/', CTCCalculatorView.as_view(), name='salary_calculator'),
    path('payroll/workflow/', PayrollWorkflowView.as_view(), name='payroll_workflow'),

    # Existing Endpoints
    path('payroll/', PayrollCalculationView.as_view(), name='payroll_calculation'),
    path('increment/', IncrementSalaryView.as_view(), name='salary_increment'),
    path('decrement/', DecrementSalaryView.as_view(), name='salary_decrement'),
    path('', include(router.urls)),
]
