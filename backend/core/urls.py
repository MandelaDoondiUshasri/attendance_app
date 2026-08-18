from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import SettingsView, HolidayViewSet

router = DefaultRouter()
router.register('holidays', HolidayViewSet, basename='holiday')

urlpatterns = [
    path('settings/', SettingsView.as_view(), name='org_settings'),
    path('', include(router.urls)),
]
