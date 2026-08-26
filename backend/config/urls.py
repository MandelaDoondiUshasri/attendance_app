from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from core.health import health_check, HealthCheckAPIView

urlpatterns = [
    path('health/', health_check, name='root_health_check'),
    path('api/v1/health/', HealthCheckAPIView.as_view(), name='api_health_check'),
    path('admin/', admin.site.super_admin_site.urls if hasattr(admin.site, 'super_admin_site') else admin.site.urls),
    path('api/v1/auth/', include('accounts.urls')),
    path('api/v1/employees/', include('employees.urls')),
    path('api/v1/attendance/', include('attendance.urls')),
    path('api/v1/leaves/', include('leaves.urls')),
    path('api/v1/wfh/', include('wfh.urls')),
    path('api/v1/salaries/', include('salaries.urls')),
    path('api/v1/notifications/', include('notifications.urls')),
    path('api/v1/reports/', include('reports.urls')),
    path('api/v1/audit/', include('audit.urls')),
    path('api/v1/core/', include('core.urls')),
]

from django.urls import re_path
from django.views.static import serve

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    ]
