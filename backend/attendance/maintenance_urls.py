from django.urls import path
from attendance.maintenance_views import (
    MaintenanceDashboardView,
    MaintenanceWorkersView,
    MaintenanceWorkerDetailView,
    MaintenanceAttendanceView,
    MaintenanceAttendanceSubmitView,
    MaintenanceAttendanceSummaryView,
    MaintenanceAttendanceHistoryView,
    MaintenanceMonthlySummaryView,
    MaintenanceBreakStatusView,
    MaintenanceBreakPauseView,
    MaintenanceBreakResumeView,
    MaintenanceGeofenceView,
)

urlpatterns = [
    path('dashboard/', MaintenanceDashboardView.as_view(), name='maintenance-dashboard'),
    path('workers/', MaintenanceWorkersView.as_view(), name='maintenance-workers'),
    path('workers/<int:worker_id>/', MaintenanceWorkerDetailView.as_view(), name='maintenance-worker-detail'),
    path('attendance/', MaintenanceAttendanceView.as_view(), name='maintenance-attendance'),
    path('attendance/submit/', MaintenanceAttendanceSubmitView.as_view(), name='maintenance-attendance-submit'),
    path('attendance/summary/', MaintenanceAttendanceSummaryView.as_view(), name='maintenance-attendance-summary'),
    path('attendance/history/', MaintenanceAttendanceHistoryView.as_view(), name='maintenance-attendance-history'),
    path('attendance/monthly-summary/', MaintenanceMonthlySummaryView.as_view(), name='maintenance-attendance-monthly-summary'),
    path('reports/', MaintenanceMonthlySummaryView.as_view(), name='maintenance-reports'),
    path('breaks/status/', MaintenanceBreakStatusView.as_view(), name='maintenance-break-status'),
    path('breaks/pause/', MaintenanceBreakPauseView.as_view(), name='maintenance-break-pause'),
    path('breaks/resume/', MaintenanceBreakResumeView.as_view(), name='maintenance-break-resume'),
    path('geofence/', MaintenanceGeofenceView.as_view(), name='maintenance-geofence'),
]
