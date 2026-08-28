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
from notifications.models import NotificationType
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
            qs = LeaveRequest.objects.all().order_by('-created_at')
        elif hasattr(user, 'employee_profile'):
            qs = LeaveRequest.objects.filter(employee=user.employee_profile).order_by('-created_at')
        else:
            return LeaveRequest.objects.none()

        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param.upper())

        return qs

    def perform_create(self, serializer):
        employee = self.request.user.employee_profile
        start_date = serializer.validated_data['start_date']
        end_date = serializer.validated_data['end_date']
        leave_type = serializer.validated_data.get('leave_type')
        days = (end_date - start_date).days + 1
        if days <= 0:
            days = 1

        # Optional Festival Leave Validation
        if leave_type and leave_type.code == 'OPT_FESTIVAL':
            from attendance.models import FestivalHoliday
            from rest_framework.exceptions import ValidationError
            
            if days > 1:
                raise ValidationError("Optional Festival Leave can only be applied for a single day.")
                
            # Check if start_date is an OPTIONAL festival
            festival = FestivalHoliday.objects.filter(date=start_date, festival_type='OPTIONAL').first()
            if not festival:
                raise ValidationError(f"The date {start_date} is not marked as an Optional Festival Holiday.")
                
            # Check if employee has already used their 1 optional leave this year
            used_optional = LeaveRequest.objects.filter(
                employee=employee,
                leave_type=leave_type,
                start_date__year=start_date.year,
                status__in=[LeaveStatus.PENDING, LeaveStatus.APPROVED]
            ).exists()
            
            if used_optional:
                raise ValidationError("You have already applied for or used your 1 Optional Festival Leave for this year.")

        instance = serializer.save(
            employee=employee,
            number_of_days=days,
            status=LeaveStatus.PENDING
        )

        AuditService.log_action(
            actor=self.request.user,
            action='APPLY_LEAVE',
            target_model='LeaveRequest',
            target_id=str(instance.id),
            reason=f"Applied for {days} days leave ({start_date} to {end_date})",
            request=self.request
        )

        leave_name = instance.leave_type.name if instance.leave_type else 'Leave'
        NotificationService.notify_management(
            title="New Leave Application Submitted",
            message=f"{employee.full_name} ({employee.employee_id}) applied for {leave_name} ({instance.start_date} to {instance.end_date}, {days} days). Reason: {instance.reason}",
            notification_type=NotificationType.LEAVE_SUBMITTED
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
            new_values={'status': 'APPROVED', 'deducted_days': float(days)},
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
