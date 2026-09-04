from django.urls import path
from reports.views import (
    DashboardAnalyticsView,
    ExportAttendanceCSVView,
    ExportLeavesCSVView,
    ExportEmployeesCSVView,
    MonthlyAttendanceSalaryReportView,
    MonthlyEmployeeDetailReportView,
    ExportMonthlyReportExcelView,
    ExportMonthlyReportCSVView,
)

urlpatterns = [
    path('analytics/', DashboardAnalyticsView.as_view(), name='dashboard_analytics'),
    path('export-attendance/', ExportAttendanceCSVView.as_view(), name='export_attendance'),
    path('export-leaves/', ExportLeavesCSVView.as_view(), name='export_leaves'),
    path('export-employees/', ExportEmployeesCSVView.as_view(), name='export_employees'),
    path('monthly-report/', MonthlyAttendanceSalaryReportView.as_view(), name='monthly_report'),
    path('monthly-report/<str:employee_id>/', MonthlyEmployeeDetailReportView.as_view(), name='monthly_employee_detail_report'),
    path('export-monthly-excel/', ExportMonthlyReportExcelView.as_view(), name='export_monthly_excel'),
    path('export-monthly-csv/', ExportMonthlyReportCSVView.as_view(), name='export_monthly_csv'),
]
