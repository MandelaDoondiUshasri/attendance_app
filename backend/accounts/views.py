from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from accounts.serializers import CustomTokenObtainPairSerializer, UserSerializer, ChangePasswordSerializer, ResetPasswordSerializer
from accounts.models import User
from audit.services import AuditService

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            email = request.data.get('email')
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

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

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
                # In production, send email token. Return success message.
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
