from rest_framework.permissions import BasePermission
from accounts.models import Role

class IsCEO(BasePermission):
    """Allows access only to CEO users."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == Role.CEO)

class IsHR(BasePermission):
    """Allows access to CEO and HR / Admin users."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role in [Role.CEO, Role.HR])

class IsEmployee(BasePermission):
    """Allows access to authenticated employees."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)
