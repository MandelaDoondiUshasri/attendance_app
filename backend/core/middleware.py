import re
from django.http import JsonResponse
from accounts.models import Role

class MobileAccessMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        
    def __call__(self, request):
        if request.path.startswith('/api/v1/') and not request.path.startswith('/api/v1/auth/'):
            user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
            is_mobile = re.search(r'mobile|android|iphone|ipad|ipod', user_agent)
            
            if is_mobile and request.user.is_authenticated:
                user = request.user
                if user.role not in [Role.CEO, Role.HR, Role.SYSTEM_ADMIN]:
                    if hasattr(user, 'employee_profile'):
                        if not user.employee_profile.mobile_access_enabled:
                            return JsonResponse({
                                'error': 'Mobile access is disabled for your account. Please use a desktop device or contact management.'
                            }, status=403)
                            
        response = self.get_response(request)
        return response
