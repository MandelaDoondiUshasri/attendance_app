from django.urls import path, include
from rest_framework.routers import DefaultRouter
from attendance.views import WFHAttendanceView, AttendanceViewSet, AttendanceCorrectionViewSet, ShiftReportViewSet

router = DefaultRouter()
router.register('corrections', AttendanceCorrectionViewSet, basename='attendance-correction')
router.register('shift-reports', ShiftReportViewSet, basename='shift-report')
router.register('', AttendanceViewSet, basename='attendance')

urlpatterns = [
    path('wfh/', WFHAttendanceView.as_view(), name='wfh_attendance'),
    path('', include(router.urls)),
]
