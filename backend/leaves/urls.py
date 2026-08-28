from django.urls import path, include
from rest_framework.routers import DefaultRouter
from leaves.views import LeaveTypeViewSet, LeaveRequestViewSet, LeaveBalanceViewSet

router = DefaultRouter()
router.register('types', LeaveTypeViewSet, basename='leave-type')
router.register('requests', LeaveRequestViewSet, basename='leave-request')
router.register('balances', LeaveBalanceViewSet, basename='leave-balance')

urlpatterns = [
    path('', include(router.urls)),
]
