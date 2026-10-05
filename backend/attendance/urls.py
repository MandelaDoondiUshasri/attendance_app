from django.urls import path, include
from rest_framework.routers import DefaultRouter
from attendance.views import (
    WFHAttendanceView, AttendanceViewSet, AttendanceCorrectionViewSet,
    ShiftReportViewSet, FestivalHolidayViewSet, EarlyPassViewSet
)

router = DefaultRouter()
router.register('early-pass', EarlyPassViewSet, basename='early-pass')
router.register('corrections', AttendanceCorrectionViewSet, basename='attendance-correction')
router.register('shift-reports', ShiftReportViewSet, basename='shift-report')
router.register('holidays', FestivalHolidayViewSet, basename='festival-holiday')
router.register('', AttendanceViewSet, basename='attendance')

urlpatterns = [
    path('wfh/', WFHAttendanceView.as_view(), name='wfh_attendance'),
    path('', include(router.urls)),
]
