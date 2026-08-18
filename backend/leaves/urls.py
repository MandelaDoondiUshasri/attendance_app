from django.urls import path, include
from rest_framework.routers import DefaultRouter
from leaves.views import LeaveTypeViewSet, LeaveRequestViewSet

router = DefaultRouter()
router.register('types', LeaveTypeViewSet, basename='leave-type')
router.register('', LeaveRequestViewSet, basename='leave-request')

urlpatterns = [
    path('', include(router.urls)),
]
