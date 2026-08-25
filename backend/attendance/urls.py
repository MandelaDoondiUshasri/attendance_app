from django.urls import path, include
from rest_framework.routers import DefaultRouter
from attendance.views import FaceAttendanceView, FingerprintAttendanceView, WFHAttendanceView, AttendanceViewSet, AttendanceCorrectionViewSet, ShiftReportViewSet

router = DefaultRouter()
router.register('corrections', AttendanceCorrectionViewSet, basename='attendance-correction')
router.register('shift-reports', ShiftReportViewSet, basename='shift-report')
router.register('', AttendanceViewSet, basename='attendance')

urlpatterns = [
    path('face/', FaceAttendanceView.as_view(), name='face_attendance'),
    path('fingerprint/', FingerprintAttendanceView.as_view(), name='fingerprint_attendance'),
    path('wfh/', WFHAttendanceView.as_view(), name='wfh_attendance'),
    path('', include(router.urls)),
]
