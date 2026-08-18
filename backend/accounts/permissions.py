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

class IsAttendanceOperator(BasePermission):
    """Allows access strictly to Attendance Operator users."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == Role.ATTENDANCE_OPERATOR)

class IsEmployee(BasePermission):
    """Allows access to authenticated employees."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

class CanTakeBiometrics(BasePermission):
    """Allows attendance operator or CEO/HR to record office face/fingerprint attendance."""
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and 
            request.user.role in [Role.ATTENDANCE_OPERATOR, Role.CEO, Role.HR]
        )
