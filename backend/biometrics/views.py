from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from biometrics.models import FaceProfile, FingerprintProfile, BiometricDevice
from biometrics.serializers import FaceProfileSerializer, BiometricDeviceSerializer, EnrollFaceSerializer, EnrollFingerprintSerializer
from employees.models import Employee
from accounts.permissions import IsHR, CanTakeBiometrics
from audit.services import AuditService
import hashlib

class BiometricDeviceViewSet(viewsets.ModelViewSet):
    queryset = BiometricDevice.objects.all().order_by('name')
    serializer_class = BiometricDeviceSerializer
    permission_classes = [IsHR]

class EnrollFaceView(APIView):
    permission_classes = [CanTakeBiometrics]

    def post(self, request):
        serializer = EnrollFaceSerializer(data=request.data)
        if serializer.is_valid():
            employee_id = serializer.validated_data['employee_id']
            image_data = serializer.validated_data['image_data']

            employee = Employee.objects.filter(employee_id=employee_id).first()
            if not employee:
                return Response({'error': f"Employee with ID '{employee_id}' not found."}, status=status.HTTP_404_NOT_FOUND)

            template_hash = hashlib.sha256(image_data.encode('utf-8')).hexdigest()

            face_profile, created = FaceProfile.objects.update_or_create(
                employee=employee,
                defaults={'template_hash': template_hash, 'liveness_enrolled': True}
            )

            employee.face_profile_enrolled = True
            employee.save()

            AuditService.log_action(
                actor=request.user,
                action='ENROLL_BIOMETRIC_FACE',
                target_model='Employee',
                target_id=str(employee.id),
                reason=f"Enrolled face biometric profile for {employee.full_name}",
                request=request
            )

            return Response({
                'message': f"Face biometric profile enrolled successfully for {employee.full_name}",
                'employee_id': employee.employee_id
            }, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class EnrollFingerprintView(APIView):
    permission_classes = [CanTakeBiometrics]

    def post(self, request):
        serializer = EnrollFingerprintSerializer(data=request.data)
        if serializer.is_valid():
            employee_id = serializer.validated_data['employee_id']
            fingerprint_data = serializer.validated_data['fingerprint_data']

            employee = Employee.objects.filter(employee_id=employee_id).first()
            if not employee:
                return Response({'error': f"Employee with ID '{employee_id}' not found."}, status=status.HTTP_404_NOT_FOUND)

            template_hash = hashlib.sha256(fingerprint_data.encode('utf-8')).hexdigest()

            fingerprint_profile, created = FingerprintProfile.objects.update_or_create(
                employee=employee,
                defaults={'template_hash': template_hash}
            )

            # Update Employee biometric_id field for compatibility
            employee.biometric_id = f"FP-{template_hash[:8].upper()}"
            employee.save()

            AuditService.log_action(
                actor=request.user,
                action='ENROLL_BIOMETRIC_FINGERPRINT',
                target_model='Employee',
                target_id=str(employee.id),
                reason=f"Enrolled fingerprint biometric profile for {employee.full_name}",
                request=request
            )

            return Response({
                'message': f"Fingerprint biometric profile enrolled successfully for {employee.full_name}",
                'employee_id': employee.employee_id,
                'biometric_id': employee.biometric_id,
                'template_hash': template_hash
            }, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
