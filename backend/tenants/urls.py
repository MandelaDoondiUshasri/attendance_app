from django.urls import path
from tenants.views import TenantProfileView, TenantPublicInfoView

urlpatterns = [
    path('profile/', TenantProfileView.as_view(), name='tenant-profile'),
    path('public/', TenantPublicInfoView.as_view(), name='tenant-public-info'),
]

