from django.urls import path, include
from rest_framework.routers import DefaultRouter
from biometrics.views import BiometricDeviceViewSet, EnrollFaceView, EnrollFingerprintView

router = DefaultRouter()
router.register('devices', BiometricDeviceViewSet, basename='biometric-device')

urlpatterns = [
    path('enroll-face/', EnrollFaceView.as_view(), name='enroll_face'),
    path('enroll-fingerprint/', EnrollFingerprintView.as_view(), name='enroll_fingerprint'),
    path('', include(router.urls)),
]
