from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from django.utils import timezone
from datetime import date
from attendance.models import Attendance, AttendanceCorrectionRequest, AttendanceStatus, AttendanceWorkMode, AttendanceMethod, CorrectionStatus, Task
from attendance.serializers import (
    AttendanceSerializer, FaceAttendanceScanSerializer,
    FingerprintAttendanceScanSerializer, WFHAttendanceScanSerializer,
    AttendanceCorrectionSerializer, TaskSerializer
)
from attendance.services import AttendanceEngine
from biometrics.services import get_face_provider, get_fingerprint_provider
from accounts.permissions import CanTakeBiometrics, IsHR, IsCEO, IsEmployee
from accounts.models import Role
from audit.services import AuditService
from notifications.services import NotificationService

class FaceAttendanceView(APIView):
    permission_classes = [CanTakeBiometrics]

    def post(self, request):
        serializer = FaceAttendanceScanSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        image_data = serializer.validated_data['image_data']
        employee_id = serializer.validated_data.get('employee_id')
        device_id = serializer.validated_data.get('device_id', 'OPERATOR-CAM-01')

        # Run face biometric provider verification
        provider = get_face_provider()
        success, employee, confidence, liveness_passed, error_msg = provider.verify_face(image_data, employee_id)

        if not success:
            AuditService.log_action(
                actor=request.user,
                action='FAILED_FACE_VERIFICATION',
                target_model='Attendance',
                reason=f"Face verification failed: {error_msg}",
                request=request
            )
            return Response({'error': error_msg or 'Face verification failed'}, status=status.HTTP_400_BAD_REQUEST)

        today = date.today()
        now = timezone.now()

        # Check for leave conflict
        if AttendanceEngine.check_leave_conflict(employee, today):
            return Response({'error': f"Employee {employee.full_name} is on APPROVED LEAVE today."}, status=status.HTTP_400_BAD_REQUEST)

        # Check existing attendance record for today
        attendance = Attendance.objects.filter(employee=employee, date=today).first()

        if attendance:
            # Handle check-out
            if not attendance.check_out:
                attendance.check_out = now
                attendance.working_hours = AttendanceEngine.calculate_working_hours(attendance.check_in, now)
                attendance.status = AttendanceEngine.calculate_final_status(attendance)
                attendance.save()

                AuditService.log_action(
                    actor=request.user,
                    action='OFFICE_CHECK_OUT',
                    target_model='Attendance',
                    target_id=str(attendance.id),
                    reason=f"Office Check-Out via FACE for {employee.full_name}",
                    request=request
                )
                return Response({
                    'message': f"Check-Out recorded for {employee.full_name}",
                    'type': 'CHECK_OUT',
                    'attendance': AttendanceSerializer(attendance).data
                }, status=status.HTTP_200_OK)
            else:
                return Response({'message': f"Attendance already completed for {employee.full_name} today."}, status=status.HTTP_200_OK)

        # Handle check-in
        calc_status = AttendanceEngine.calculate_status(now, AttendanceWorkMode.OFFICE)

        attendance = Attendance.objects.create(
            employee=employee,
            date=today,
            check_in=now,
            status=calc_status,
            work_mode=AttendanceWorkMode.OFFICE,
            attendance_method=AttendanceMethod.FACE,
            face_verified=True,
            liveness_verified=liveness_passed,
            location_verified=True,
            device_id=device_id,
            taken_by=request.user
        )

        AuditService.log_action(
            actor=request.user,
            action='OFFICE_CHECK_IN',
            target_model='Attendance',
            target_id=str(attendance.id),
            new_values={'employee': employee.employee_id, 'status': calc_status, 'method': 'FACE'},
            reason=f"Office Check-In via FACE for {employee.full_name}",
            request=request
        )

        return Response({
            'message': f"Check-In recorded: {calc_status}",
            'type': 'CHECK_IN',
            'attendance': AttendanceSerializer(attendance).data
        }, status=status.HTTP_201_CREATED)

class FingerprintAttendanceView(APIView):
    permission_classes = [CanTakeBiometrics]

    def post(self, request):
        serializer = FingerprintAttendanceScanSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        biometric_id = serializer.validated_data.get('biometric_id')
        fingerprint_hash = serializer.validated_data.get('fingerprint_hash')
        device_id = serializer.validated_data.get('device_id', 'OPERATOR-FP-01')

        provider = get_fingerprint_provider()
        if fingerprint_hash:
            success, employee, error_msg = provider.verify_fingerprint_by_hash(fingerprint_hash)
        elif biometric_id:
            success, employee, error_msg = provider.verify_fingerprint(biometric_id)
        else:
            return Response({'error': 'Either biometric_id or fingerprint_hash is required'}, status=status.HTTP_400_BAD_REQUEST)

        if not success:
            identifier = fingerprint_hash or biometric_id
            AuditService.log_action(
                actor=request.user,
                action='FAILED_FINGERPRINT_VERIFICATION',
                target_model='Attendance',
                reason=f"Fingerprint verification failed for {identifier}: {error_msg}",
                request=request
            )
            return Response({'error': error_msg or 'Fingerprint verification failed'}, status=status.HTTP_400_BAD_REQUEST)

        today = date.today()
        now = timezone.now()

        if AttendanceEngine.check_leave_conflict(employee, today):
            return Response({'error': f"Employee {employee.full_name} is on APPROVED LEAVE today."}, status=status.HTTP_400_BAD_REQUEST)

        attendance = Attendance.objects.filter(employee=employee, date=today).first()

        if attendance:
            if not attendance.check_out:
                attendance.check_out = now
                attendance.working_hours = AttendanceEngine.calculate_working_hours(attendance.check_in, now)
                attendance.status = AttendanceEngine.calculate_final_status(attendance)
                attendance.save()

                AuditService.log_action(
                    actor=request.user,
                    action='OFFICE_CHECK_OUT',
                    target_model='Attendance',
                    target_id=str(attendance.id),
                    reason=f"Office Check-Out via FINGERPRINT for {employee.full_name}",
                    request=request
                )
                return Response({
                    'message': f"Check-Out recorded for {employee.full_name}",
                    'type': 'CHECK_OUT',
                    'attendance': AttendanceSerializer(attendance).data
                }, status=status.HTTP_200_OK)
            else:
                return Response({'message': f"Attendance already completed for {employee.full_name} today."}, status=status.HTTP_200_OK)

        calc_status = AttendanceEngine.calculate_status(now, AttendanceWorkMode.OFFICE)

        attendance = Attendance.objects.create(
            employee=employee,
            date=today,
            check_in=now,
            status=calc_status,
            work_mode=AttendanceWorkMode.OFFICE,
            attendance_method=AttendanceMethod.FINGERPRINT,
            face_verified=False,
            liveness_verified=False,
            location_verified=True,
            device_id=device_id,
            taken_by=request.user
        )

        AuditService.log_action(
            actor=request.user,
            action='OFFICE_CHECK_IN',
            target_model='Attendance',
            target_id=str(attendance.id),
            new_values={'employee': employee.employee_id, 'status': calc_status, 'method': 'FINGERPRINT'},
            reason=f"Office Check-In via FINGERPRINT for {employee.full_name}",
            request=request
        )

        return Response({
            'message': f"Check-In recorded: {calc_status}",
            'type': 'CHECK_IN',
            'attendance': AttendanceSerializer(attendance).data
        }, status=status.HTTP_201_CREATED)

class WFHAttendanceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not hasattr(request.user, 'employee_profile'):
            return Response({'error': 'User does not have an active employee profile.'}, status=status.HTTP_400_BAD_REQUEST)

        employee = request.user.employee_profile
        today = date.today()
        now = timezone.now()

        # Rule 12: WFH Attendance requires an APPROVED WFH request for today
        if not AttendanceEngine.check_wfh_approval(employee, today):
            return Response({'error': 'WFH Attendance requires an APPROVED WFH request for today. Please apply for WFH first.'}, status=status.HTTP_400_BAD_REQUEST)

        # Rule 11: Leave conflict check
        if AttendanceEngine.check_leave_conflict(employee, today):
            return Response({'error': 'You are on APPROVED LEAVE today. WFH check-in is not allowed.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = WFHAttendanceScanSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        image_data = serializer.validated_data['image_data']
        latitude = serializer.validated_data['latitude']
        longitude = serializer.validated_data['longitude']
        device_id = serializer.validated_data.get('device_id', 'WFH-MOBILE-WEB')

        # Face & liveness check
        provider = get_face_provider()
        success, matched_emp, confidence, liveness_passed, error_msg = provider.verify_face(image_data, employee.employee_id)

        if not success:
            AuditService.log_action(
                actor=request.user,
                action='FAILED_WFH_VERIFICATION',
                target_model='Attendance',
                reason=f"WFH verification failed: {error_msg}",
                request=request
            )
            return Response({'error': error_msg or 'WFH face/liveness verification failed'}, status=status.HTTP_400_BAD_REQUEST)

        attendance = Attendance.objects.filter(employee=employee, date=today).first()

        if attendance:
            if not attendance.check_out:
                attendance.check_out = now
                attendance.working_hours = AttendanceEngine.calculate_working_hours(attendance.check_in, now)
                attendance.status = AttendanceEngine.calculate_final_status(attendance)
                attendance.save()

                AuditService.log_action(
                    actor=request.user,
                    action='WFH_CHECK_OUT',
                    target_model='Attendance',
                    target_id=str(attendance.id),
                    reason=f"WFH Check-Out recorded for {employee.full_name}",
                    request=request
                )
                return Response({
                    'message': f"WFH Check-Out recorded for {employee.full_name}",
                    'type': 'CHECK_OUT',
                    'attendance': AttendanceSerializer(attendance).data
                }, status=status.HTTP_200_OK)
            else:
                return Response({'message': 'WFH Attendance already completed for today.'}, status=status.HTTP_200_OK)

        attendance = Attendance.objects.create(
            employee=employee,
            date=today,
            check_in=now,
            status=AttendanceStatus.WFH,
            work_mode=AttendanceWorkMode.WFH,
            attendance_method=AttendanceMethod.FACE,
            face_verified=True,
            liveness_verified=liveness_passed,
            location_verified=True,
            latitude=latitude,
            longitude=longitude,
            device_id=device_id,
            taken_by=request.user
        )

        AuditService.log_action(
            actor=request.user,
            action='WFH_CHECK_IN',
            target_model='Attendance',
            target_id=str(attendance.id),
            new_values={'employee': employee.employee_id, 'lat': latitude, 'long': longitude},
            reason=f"WFH Check-In recorded for {employee.full_name}",
            request=request
        )

        return Response({
            'message': 'WFH Check-In recorded successfully',
            'type': 'CHECK_IN',
            'attendance': AttendanceSerializer(attendance).data
        }, status=status.HTTP_201_CREATED)

class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = Attendance.objects.all().order_by('-date', '-check_in')
    serializer_class = AttendanceSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = Attendance.objects.all().order_by('-date', '-check_in')

        if user.role in [Role.CEO, Role.HR, Role.ATTENDANCE_OPERATOR]:
            # Apply optional filters
            emp_id = self.request.query_params.get('employee')
            dept_id = self.request.query_params.get('department')
            status_param = self.request.query_params.get('status')
            date_param = self.request.query_params.get('date')

            if emp_id:
                queryset = queryset.filter(employee_id=emp_id)
            if dept_id:
                queryset = queryset.filter(employee__department_id=dept_id)
            if status_param:
                queryset = queryset.filter(status=status_param)
            if date_param:
                queryset = queryset.filter(date=date_param)

            return queryset

        # Employee only sees own attendance
        if hasattr(user, 'employee_profile'):
            return queryset.filter(employee=user.employee_profile)
        return Attendance.objects.none()

    @action(detail=False, methods=['get'])
    def today_summary(self, request):
        today = date.today()
        attendances = Attendance.objects.filter(date=today)

        present_count = attendances.filter(status__in=[AttendanceStatus.PRESENT, AttendanceStatus.LATE]).count()
        wfh_count = attendances.filter(status=AttendanceStatus.WFH).count()
        leave_count = attendances.filter(status=AttendanceStatus.LEAVE).count()
        late_count = attendances.filter(status=AttendanceStatus.LATE).count()
        return Response({
            'date': today,
            'total_recorded': attendances.count(),
            'present_count': present_count,
            'wfh_count': wfh_count,
            'leave_count': leave_count,
            'late_count': late_count,
        })

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def clock_in(self, request):
        user = request.user
        if not hasattr(user, 'employee_profile'):
            return Response({'error': 'User does not have an active employee profile.'}, status=status.HTTP_400_BAD_REQUEST)
        
        employee = user.employee_profile
        today = date.today()
        now = timezone.now()

        if AttendanceEngine.check_leave_conflict(employee, today):
            return Response({'error': 'You are on APPROVED LEAVE today. Clock-in is not allowed.'}, status=status.HTTP_400_BAD_REQUEST)

        attendance = Attendance.objects.filter(employee=employee, date=today).first()
        if attendance:
            return Response({'error': 'You have already clocked in for today.', 'attendance': AttendanceSerializer(attendance).data}, status=status.HTTP_400_BAD_REQUEST)

        work_mode = request.data.get('work_mode', AttendanceWorkMode.OFFICE)
        if work_mode == AttendanceWorkMode.WFH:
            if not AttendanceEngine.check_wfh_approval(employee, today):
                return Response({'error': 'WFH requires an APPROVED WFH request for today. Please submit a request first.'}, status=status.HTTP_400_BAD_REQUEST)

        calc_status = AttendanceEngine.calculate_status(now, work_mode)

        attendance = Attendance.objects.create(
            employee=employee,
            date=today,
            check_in=now,
            status=calc_status,
            work_mode=work_mode,
            attendance_method=AttendanceMethod.WEB_PORTAL,
            face_verified=False,
            liveness_verified=False,
            location_verified=False,
            device_id='WEB-PORTAL-CLIENT',
            taken_by=user
        )

        AuditService.log_action(
            actor=user,
            action='CLOCK_IN',
            target_model='Attendance',
            target_id=str(attendance.id),
            reason=f"Clocked In via Web Portal ({work_mode})",
            request=request
        )

        return Response({
            'message': 'Clock-in successful',
            'attendance': AttendanceSerializer(attendance).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def clock_out(self, request):
        user = request.user
        if not hasattr(user, 'employee_profile'):
            return Response({'error': 'User does not have an active employee profile.'}, status=status.HTTP_400_BAD_REQUEST)
        
        employee = user.employee_profile
        today = date.today()
        now = timezone.now()

        attendance = Attendance.objects.filter(employee=employee, date=today, check_out__isnull=True).first()
        if not attendance:
            return Response({'error': 'No active clocked-in session found for today.'}, status=status.HTTP_400_BAD_REQUEST)

        attendance.check_out = now
        attendance.working_hours = AttendanceEngine.calculate_working_hours(attendance.check_in, now)
        attendance.status = AttendanceEngine.calculate_final_status(attendance)
        attendance.save()

        AuditService.log_action(
            actor=user,
            action='CLOCK_OUT',
            target_model='Attendance',
            target_id=str(attendance.id),
            reason=f"Clocked Out via Web Portal. Working Hours: {attendance.working_hours}",
            request=request
        )

        return Response({
            'message': 'Clock-out successful',
            'attendance': AttendanceSerializer(attendance).data
        }, status=status.HTTP_200_OK)

class AttendanceCorrectionViewSet(viewsets.ModelViewSet):
    queryset = AttendanceCorrectionRequest.objects.all().order_by('-created_at')
    serializer_class = AttendanceCorrectionSerializer

    def get_permissions(self):
        if self.action in ['approve', 'reject']:
            return [IsHR()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if user.role in [Role.CEO, Role.HR]:
            return AttendanceCorrectionRequest.objects.all().order_by('-created_at')
        if hasattr(user, 'employee_profile'):
            return AttendanceCorrectionRequest.objects.filter(employee=user.employee_profile).order_by('-created_at')
        return AttendanceCorrectionRequest.objects.none()

    def perform_create(self, serializer):
        employee = self.request.user.employee_profile
        existing_att = Attendance.objects.filter(employee=employee, date=serializer.validated_data['date']).first()
        serializer.save(
            employee=employee,
            attendance=existing_att,
            original_check_in=existing_att.check_in if existing_att else None,
            original_check_out=existing_att.check_out if existing_att else None,
        )
        AuditService.log_action(
            actor=self.request.user,
            action='SUBMIT_ATTENDANCE_CORRECTION',
            target_model='AttendanceCorrectionRequest',
            target_id=str(serializer.instance.id),
            reason=f"Submitted correction request for date {serializer.validated_data['date']}",
            request=self.request
        )

    @action(detail=True, methods=['post'], permission_classes=[IsHR])
    def approve(self, request, pk=None):
        correction = self.get_object()
        if correction.status != CorrectionStatus.PENDING:
            return Response({'error': 'Correction request is not pending'}, status=status.HTTP_400_BAD_REQUEST)

        correction.status = CorrectionStatus.APPROVED
        correction.reviewed_by = request.user
        correction.save()

        # Update or create attendance record without deleting original data
        attendance, created = Attendance.objects.get_or_create(
            employee=correction.employee,
            date=correction.date,
            defaults={
                'check_in': correction.requested_check_in,
                'check_out': correction.requested_check_out,
                'status': AttendanceStatus.PRESENT,
                'work_mode': AttendanceWorkMode.OFFICE,
                'attendance_method': AttendanceMethod.MANUAL_CORRECTION,
                'taken_by': request.user
            }
        )

        attendance.check_in = correction.requested_check_in
        attendance.check_out = correction.requested_check_out
        attendance.working_hours = AttendanceEngine.calculate_working_hours(correction.requested_check_in, correction.requested_check_out)
        attendance.status = AttendanceEngine.calculate_final_status(attendance)
        attendance.attendance_method = AttendanceMethod.MANUAL_CORRECTION
        attendance.save()

        # Notify Employee
        NotificationService.create_notification(
            recipient=correction.employee.user,
            title="Attendance Correction Approved",
            message=f"Your attendance correction request for {correction.date} has been APPROVED by HR/CEO.",
            notification_type='CORRECTION_APPROVED'
        )

        AuditService.log_action(
            actor=request.user,
            action='APPROVE_ATTENDANCE_CORRECTION',
            target_model='AttendanceCorrectionRequest',
            target_id=str(correction.id),
            old_values={'original_check_in': str(correction.original_check_in)},
            new_values={'requested_check_in': str(correction.requested_check_in)},
            reason=f"Approved attendance correction for {correction.employee.full_name}",
            request=request
        )

        return Response({'message': 'Attendance correction APPROVED and attendance updated.'})

    @action(detail=True, methods=['post'], permission_classes=[IsHR])
    def reject(self, request, pk=None):
        correction = self.get_object()
        reason = request.data.get('rejection_reason', 'Request rejected by authority.')
        correction.status = CorrectionStatus.REJECTED
        correction.reviewed_by = request.user
        correction.rejection_reason = reason
        correction.save()

        NotificationService.create_notification(
            recipient=correction.employee.user,
            title="Attendance Correction Rejected",
            message=f"Your attendance correction request for {correction.date} was REJECTED: {reason}",
            notification_type='CORRECTION_REJECTED'
        )

        AuditService.log_action(
            actor=request.user,
            action='REJECT_ATTENDANCE_CORRECTION',
            target_model='AttendanceCorrectionRequest',
            target_id=str(correction.id),
            reason=f"Rejected attendance correction for {correction.employee.full_name}: {reason}",
            request=request
        )

        return Response({'message': 'Attendance correction REJECTED.'})

class TaskViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TaskSerializer

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'employee_profile'):
            return Task.objects.filter(employee=user.employee_profile).order_by('-created_at')
        return Task.objects.none()

    def perform_create(self, serializer):
        serializer.save(employee=self.request.user.employee_profile)
