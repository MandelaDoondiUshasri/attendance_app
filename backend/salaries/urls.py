from django.urls import path, include
from rest_framework.routers import DefaultRouter
from salaries.views import (
    SalaryViewSet, SalaryHistoryViewSet,
    IncrementSalaryView, DecrementSalaryView,
    PayrollCalculationView,
    PayslipManagementViewSet,
    EmployeePayslipViewSet
)

router = DefaultRouter()
router.register('payslips', PayslipManagementViewSet, basename='payslip-management')
router.register('my-payslips', EmployeePayslipViewSet, basename='my-payslips')
router.register('history', SalaryHistoryViewSet, basename='salary-history')
router.register('', SalaryViewSet, basename='salary')

urlpatterns = [
    path('payroll/', PayrollCalculationView.as_view(), name='payroll_calculation'),
    path('increment/', IncrementSalaryView.as_view(), name='salary_increment'),
    path('decrement/', DecrementSalaryView.as_view(), name='salary_decrement'),
    path('', include(router.urls)),
]
