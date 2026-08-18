from django.urls import path, include
from rest_framework.routers import DefaultRouter
from employees.views import EmployeeViewSet, DepartmentViewSet, DesignationViewSet

router = DefaultRouter()
router.register('departments', DepartmentViewSet, basename='department')
router.register('designations', DesignationViewSet, basename='designation')
router.register('', EmployeeViewSet, basename='employee')

urlpatterns = [
    path('', include(router.urls)),
]
