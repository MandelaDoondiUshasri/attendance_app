from django.urls import path
from reports.views import (
    DashboardAnalyticsView,
    ExportAttendanceCSVView,
    ExportLeavesCSVView,
    ExportEmployeesCSVView
)

urlpatterns = [
    path('analytics/', DashboardAnalyticsView.as_view(), name='dashboard_analytics'),
    path('export-attendance/', ExportAttendanceCSVView.as_view(), name='export_attendance'),
    path('export-leaves/', ExportLeavesCSVView.as_view(), name='export_leaves'),
    path('export-employees/', ExportEmployeesCSVView.as_view(), name='export_employees'),
]
