from django.urls import path, include
from rest_framework.routers import DefaultRouter
from wfh.views import WFHRequestViewSet

router = DefaultRouter()
router.register('requests', WFHRequestViewSet, basename='wfh-request')

urlpatterns = [
    path('', include(router.urls)),
]
