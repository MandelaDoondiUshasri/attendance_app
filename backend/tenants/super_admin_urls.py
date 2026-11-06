from django.urls import path, include
from rest_framework.routers import DefaultRouter
from tenants.views import (
    SuperAdminDashboardStatsView, CompanyManagementViewSet,
    SubscriptionPlanViewSet, CompanySubscriptionViewSet
)

router = DefaultRouter()
router.register('companies', CompanyManagementViewSet, basename='sa-companies')
router.register('plans', SubscriptionPlanViewSet, basename='sa-plans')
router.register('subscriptions', CompanySubscriptionViewSet, basename='sa-subscriptions')

urlpatterns = [
    path('stats/', SuperAdminDashboardStatsView.as_view(), name='sa-stats'),
    path('dashboard/stats/', SuperAdminDashboardStatsView.as_view(), name='sa-dashboard-stats'),
    path('', include(router.urls)),
]

