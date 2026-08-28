from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from wfh.models import WFHRequest, WFHStatus
from wfh.serializers import WFHRequestSerializer
from accounts.permissions import IsHR, IsCEO
from accounts.models import Role
from audit.services import AuditService
from notifications.models import NotificationType
from notifications.services import NotificationService

class WFHRequestViewSet(viewsets.ModelViewSet):
    queryset = WFHRequest.objects.all().order_by('-date')
    serializer_class = WFHRequestSerializer

    def get_permissions(self):
        if self.action in ['approve', 'reject']:
            return [IsHR()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if user.role in [Role.CEO, Role.HR, Role.SYSTEM_ADMIN]:
            qs = WFHRequest.objects.all().order_by('-date')
        elif hasattr(user, 'employee_profile'):
            qs = WFHRequest.objects.filter(employee=user.employee_profile).order_by('-date')
        else:
            return WFHRequest.objects.none()

        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param.upper())

        date_param = self.request.query_params.get('date')
        if date_param:
            qs = qs.filter(date=date_param)

        return qs

    def perform_create(self, serializer):
        employee = self.request.user.employee_profile
        instance = serializer.save(
            employee=employee,
            status=WFHStatus.PENDING
        )
        AuditService.log_action(
            actor=self.request.user,
            action='APPLY_WFH',
            target_model='WFHRequest',
            target_id=str(instance.id),
            reason=f"Applied for WFH on date {serializer.validated_data['date']}",
            request=self.request
        )

        NotificationService.notify_management(
            title="New WFH Request Submitted",
            message=f"{employee.full_name} ({employee.employee_id}) requested Remote WFH for {instance.date}. Reason: {instance.reason}",
            notification_type=NotificationType.WFH_SUBMITTED
        )

    @action(detail=True, methods=['post'], permission_classes=[IsHR])
    def approve(self, request, pk=None):
        wfh = self.get_object()
        if wfh.status != WFHStatus.PENDING:
            return Response({'error': 'WFH request is not in PENDING status.'}, status=status.HTTP_400_BAD_REQUEST)

        wfh.status = WFHStatus.APPROVED
        wfh.reviewed_by = request.user
        wfh.save()

        NotificationService.create_notification(
            recipient=wfh.employee.user,
            title="WFH Request Approved",
            message=f"Your WFH request for {wfh.date} has been APPROVED. You can now mark WFH attendance.",
            notification_type='WFH_APPROVED'
        )

        AuditService.log_action(
            actor=request.user,
            action='APPROVE_WFH',
            target_model='WFHRequest',
            target_id=str(wfh.id),
            reason=f"Approved WFH request for {wfh.employee.full_name} ({wfh.date})",
            request=request
        )

        return Response({'message': f"WFH request APPROVED for {wfh.employee.full_name}."})

    @action(detail=True, methods=['post'], permission_classes=[IsHR])
    def reject(self, request, pk=None):
        wfh = self.get_object()
        if wfh.status != WFHStatus.PENDING:
            return Response({'error': 'WFH request is not in PENDING status.'}, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('rejection_reason', 'WFH request rejected by management.')
        wfh.status = WFHStatus.REJECTED
        wfh.reviewed_by = request.user
        wfh.rejection_reason = reason
        wfh.save()

        NotificationService.create_notification(
            recipient=wfh.employee.user,
            title="WFH Request Rejected",
            message=f"Your WFH request for {wfh.date} was REJECTED: {reason}",
            notification_type='WFH_REJECTED'
        )

        AuditService.log_action(
            actor=request.user,
            action='REJECT_WFH',
            target_model='WFHRequest',
            target_id=str(wfh.id),
            reason=f"Rejected WFH request for {wfh.employee.full_name}: {reason}",
            request=request
        )

        return Response({'message': 'WFH request REJECTED.'})
