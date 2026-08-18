from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.utils import timezone
from datetime import timedelta
from leaves.models import LeaveType, LeaveBalance, LeaveRequest, LeaveStatus
from leaves.serializers import LeaveTypeSerializer, LeaveBalanceSerializer, LeaveRequestSerializer
from attendance.models import Attendance, AttendanceStatus, AttendanceWorkMode, AttendanceMethod
from accounts.permissions import IsHR, IsCEO
from accounts.models import Role
from audit.services import AuditService
from notifications.services import NotificationService

class LeaveTypeViewSet(viewsets.ModelViewSet):
    queryset = LeaveType.objects.all().order_by('name')
    serializer_class = LeaveTypeSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsHR()]
        return [permissions.IsAuthenticated()]

class LeaveRequestViewSet(viewsets.ModelViewSet):
    queryset = LeaveRequest.objects.all().order_by('-created_at')
    serializer_class = LeaveRequestSerializer

    def get_permissions(self):
        if self.action in ['approve', 'reject']:
            return [IsHR()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if user.role in [Role.CEO, Role.HR]:
            return LeaveRequest.objects.all().order_by('-created_at')
        if hasattr(user, 'employee_profile'):
            return LeaveRequest.objects.filter(employee=user.employee_profile).order_by('-created_at')
        return LeaveRequest.objects.none()

    def perform_create(self, serializer):
        employee = self.request.user.employee_profile
        start_date = serializer.validated_data['start_date']
        end_date = serializer.validated_data['end_date']
        days = (end_date - start_date).days + 1
        if days <= 0:
            days = 1

        serializer.save(
            employee=employee,
            number_of_days=days,
            status=LeaveStatus.PENDING
        )

        AuditService.log_action(
            actor=self.request.user,
            action='APPLY_LEAVE',
            target_model='LeaveRequest',
            target_id=str(serializer.instance.id),
            reason=f"Applied for {days} days leave ({start_date} to {end_date})",
            request=self.request
        )

    @action(detail=True, methods=['post'], permission_classes=[IsHR])
    def approve(self, request, pk=None):
        leave = self.get_object()
        if leave.status != LeaveStatus.PENDING:
            return Response({'error': 'Leave request is not in PENDING status.'}, status=status.HTTP_400_BAD_REQUEST)

        employee = leave.employee
        days = leave.number_of_days

        # Deduct leave balance
        if employee.leave_balance >= days:
            employee.leave_balance -= days
        else:
            employee.leave_balance = max(0, employee.leave_balance - days)
        employee.save()

        # Update specific leave type balance if exists
        bal = LeaveBalance.objects.filter(employee=employee, leave_type=leave.leave_type).first()
        if bal:
            bal.remaining_days = max(0, bal.remaining_days - days)
            bal.save()

        leave.status = LeaveStatus.APPROVED
        leave.reviewed_by = request.user
        leave.approved_date = timezone.now()
        leave.save()

        # Create or update Attendance records for all dates in range to LEAVE
        curr_date = leave.start_date
        while curr_date <= leave.end_date:
            Attendance.objects.update_or_create(
                employee=employee,
                date=curr_date,
                defaults={
                    'check_in': timezone.now(),
                    'status': AttendanceStatus.LEAVE,
                    'work_mode': AttendanceWorkMode.OFFICE,
                    'attendance_method': AttendanceMethod.MANUAL_CORRECTION,
                    'taken_by': request.user
                }
            )
            curr_date += timedelta(days=1)

        NotificationService.create_notification(
            recipient=employee.user,
            title="Leave Request Approved",
            message=f"Your leave request from {leave.start_date} to {leave.end_date} has been APPROVED.",
            notification_type='LEAVE_APPROVED'
        )

        AuditService.log_action(
            actor=request.user,
            action='APPROVE_LEAVE',
            target_model='LeaveRequest',
            target_id=str(leave.id),
            new_values={'status': 'APPROVED', 'deducted_days': days},
            reason=f"Approved leave request for {employee.full_name}",
            request=request
        )

        return Response({'message': f"Leave request APPROVED for {employee.full_name}. Balance deducted & attendance updated."})

    @action(detail=True, methods=['post'], permission_classes=[IsHR])
    def reject(self, request, pk=None):
        leave = self.get_object()
        if leave.status != LeaveStatus.PENDING:
            return Response({'error': 'Leave request is not in PENDING status.'}, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('rejection_reason', 'Leave request rejected by management.')
        leave.status = LeaveStatus.REJECTED
        leave.reviewed_by = request.user
        leave.rejection_reason = reason
        leave.save()

        # Leave balance and attendance remain unchanged as per spec

        NotificationService.create_notification(
            recipient=leave.employee.user,
            title="Leave Request Rejected",
            message=f"Your leave request from {leave.start_date} to {leave.end_date} was REJECTED: {reason}",
            notification_type='LEAVE_REJECTED'
        )

        AuditService.log_action(
            actor=request.user,
            action='REJECT_LEAVE',
            target_model='LeaveRequest',
            target_id=str(leave.id),
            reason=f"Rejected leave request for {leave.employee.full_name}: {reason}",
            request=request
        )

        return Response({'message': 'Leave request REJECTED.'})
