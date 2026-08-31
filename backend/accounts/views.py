import re
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from accounts.serializers import CustomTokenObtainPairSerializer, UserSerializer, ChangePasswordSerializer, ResetPasswordSerializer, ResetPasswordConfirmSerializer
from accounts.models import User
from audit.services import AuditService
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.conf import settings

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
        is_mobile = bool(re.search(r'android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile', user_agent))
        
        email = request.data.get('email')
        if email:
            user = User.objects.filter(email=email).first()
            if user and user.role == 'EMPLOYEE' and is_mobile:
                AuditService.log_action(
                    actor=user,
                    action='FAILED_LOGIN',
                    target_model='User',
                    target_id=str(user.id),
                    reason='Employee attempted mobile login',
                    request=request
                )
                return Response(
                    {'message': 'Employee login is restricted to laptops and desktops.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            user = User.objects.filter(email=email).first()
            if user:
                AuditService.log_action(
                    actor=user,
                    action='LOGIN',
                    target_model='User',
                    target_id=str(user.id),
                    new_values={'email': user.email, 'role': user.role},
                    reason='User logged in successfully',
                    request=request
                )
        else:
            AuditService.log_action(
                actor=None,
                action='FAILED_LOGIN',
                target_model='User',
                target_id=request.data.get('email', 'unknown'),
                reason='Invalid credentials provided',
                request=request
            )
        return response

class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            AuditService.log_action(
                actor=request.user,
                action='LOGOUT',
                target_model='User',
                target_id=str(request.user.id),
                reason='User logged out',
                request=request
            )
            return Response({'message': 'Logged out successfully'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class UserProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        serializer = UserSerializer(request.user, context={'request': request})
        return Response(serializer.data)

    def patch(self, request):
        user = request.user
        if 'avatar' in request.FILES:
            user.avatar = request.FILES['avatar']
            user.save(update_fields=['avatar'])

        serializer = UserSerializer(user, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            saved_user = serializer.save()
            AuditService.log_action(
                actor=request.user,
                action='UPDATE_PROFILE',
                target_model='User',
                target_id=str(request.user.id),
                reason='User updated profile information',
                request=request
            )
            return Response(UserSerializer(saved_user, context={'request': request}).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if serializer.is_valid():
            user = request.user
            if not user.check_password(serializer.validated_data['old_password']):
                return Response({'error': 'Incorrect current password'}, status=status.HTTP_400_BAD_REQUEST)
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            AuditService.log_action(
                actor=user,
                action='CHANGE_PASSWORD',
                target_model='User',
                target_id=str(user.id),
                reason='Password changed by user',
                request=request
            )
            return Response({'message': 'Password updated successfully'}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            user = User.objects.filter(email=email).first()
            if user:
                token = default_token_generator.make_token(user)
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                
                # Determine origin for frontend link
                origin = request.headers.get('origin')
                if not origin:
                    # Fallback if origin is not provided
                    origin = "http://localhost:5173" if settings.DEBUG else "https://yourproductiondomain.com"
                
                reset_url = f"{origin}/reset-password?uidb64={uid}&token={token}"
                
                send_mail(
                    subject="Password Reset Request",
                    message=f"You requested a password reset. Click the link below to reset your password:\n\n{reset_url}\n\nIf you did not request this, please ignore this email.",
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
                )

                AuditService.log_action(
                    actor=user,
                    action='FORGOT_PASSWORD_REQUEST',
                    target_model='User',
                    target_id=str(user.id),
                    reason='Password reset link requested',
                    request=request
                )
            return Response({'message': 'If account exists, password reset instructions have been sent.'}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ResetPasswordConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ResetPasswordConfirmSerializer(data=request.data)
        if serializer.is_valid():
            uidb64 = serializer.validated_data['uidb64']
            token = serializer.validated_data['token']
            new_password = serializer.validated_data['new_password']

            try:
                uid = force_str(urlsafe_base64_decode(uidb64))
                user = User.objects.get(pk=uid)
            except (TypeError, ValueError, OverflowError, User.DoesNotExist):
                user = None

            if user is not None and default_token_generator.check_token(user, token):
                user.set_password(new_password)
                user.save()
                AuditService.log_action(
                    actor=user,
                    action='RESET_PASSWORD_CONFIRM',
                    target_model='User',
                    target_id=str(user.id),
                    reason='User reset their password successfully',
                    request=request
                )
                return Response({'message': 'Password has been reset successfully.'}, status=status.HTTP_200_OK)
            else:
                return Response({'error': 'Invalid token or token has expired.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
