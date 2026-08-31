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
        if self.action in ['update', 'partial_update', 'destroy', 'approve', 'reject']:
            return [IsHR()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if user.role in [Role.CEO, Role.HR, Role.SYSTEM_ADMIN]:
            qs = LeaveRequest.objects.all().order_by('-created_at')
        elif hasattr(user, 'employee_profile'):
            qs = LeaveRequest.objects.filter(employee=user.employee_profile).order_by('-created_at')
        else:
            return LeaveRequest.objects.none()

        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param.upper())

        return qs

    def perform_update(self, serializer):
        instance = self.get_object()
        old_status = instance.status
        old_days = instance.number_of_days
        old_start = instance.start_date
        old_end = instance.end_date

        start_date = serializer.validated_data.get('start_date', instance.start_date)
        end_date = serializer.validated_data.get('end_date', instance.end_date)
        days = float((end_date - start_date).days + 1)
        if days <= 0:
            days = 1.0
        
        is_half_day = serializer.validated_data.get('is_half_day', instance.is_half_day)
        if is_half_day:
            days = 0.5

        new_status = serializer.validated_data.get('status', instance.status)
        employee = instance.employee

        updated_instance = serializer.save(
            number_of_days=days,
            reviewed_by=self.request.user if new_status != LeaveStatus.PENDING else instance.reviewed_by
        )

        # Handle status transitions and attendance sync
        if old_status != LeaveStatus.APPROVED and new_status == LeaveStatus.APPROVED:
            # Deduct balances
            employee.leave_balance = max(0, employee.leave_balance - days)
            employee.save()

            bal = LeaveBalance.objects.filter(employee=employee, leave_type=updated_instance.leave_type).first()
            if bal:
                bal.remaining_days = max(0, bal.remaining_days - days)
                bal.save()

            # Mark attendance as LEAVE
            curr_date = start_date
            while curr_date <= end_date:
                Attendance.objects.update_or_create(
                    employee=employee,
                    date=curr_date,
                    defaults={
                        'check_in': timezone.now(),
                        'status': AttendanceStatus.LEAVE,
                        'work_mode': AttendanceWorkMode.OFFICE,
                        'attendance_method': AttendanceMethod.MANUAL_CORRECTION,
                        'taken_by': self.request.user
                    }
                )
                curr_date += timedelta(days=1)

        elif old_status == LeaveStatus.APPROVED and new_status in [LeaveStatus.REJECTED, LeaveStatus.PENDING]:
            # Restore balances
            employee.leave_balance += old_days
            employee.save()

            bal = LeaveBalance.objects.filter(employee=employee, leave_type=instance.leave_type).first()
            if bal:
                bal.remaining_days += old_days
                bal.save()

            # Revert attendance records for old range
            Attendance.objects.filter(
                employee=employee,
                date__range=[old_start, old_end],
                status=AttendanceStatus.LEAVE
            ).delete()

        AuditService.log_action(
            actor=self.request.user,
            action='EDIT_LEAVE',
            target_model='LeaveRequest',
            target_id=str(updated_instance.id),
            new_values={'status': new_status, 'start_date': str(start_date), 'end_date': str(end_date), 'number_of_days': days},
            reason=f"Edited leave record for {employee.full_name}",
            request=self.request
        )

    def perform_create(self, serializer):
        employee = self.request.user.employee_profile
        start_date = serializer.validated_data['start_date']
        end_date = serializer.validated_data['end_date']
        leave_type = serializer.validated_data.get('leave_type')
        days = float((end_date - start_date).days + 1)
        if days <= 0:
            days = 1.0
            
        is_half_day = serializer.validated_data.get('is_half_day', False)
        if is_half_day:
            days = 0.5

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


class LeaveBalanceViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        user = request.user
        from django.db.models import Sum
        from employees.models import Employee

        current_year = timezone.now().year
        leave_types = list(LeaveType.objects.all().order_by('name'))

        def compute_employee_balance(emp):
            type_balances = []
            total_allowed_all = 0
            total_used_all = 0
            total_pending_all = 0
            total_remaining_all = 0

            for lt in leave_types:
                # Used days (APPROVED leaves in current year)
                used = LeaveRequest.objects.filter(
                    employee=emp,
                    leave_type=lt,
                    status=LeaveStatus.APPROVED,
                    start_date__year=current_year
                ).aggregate(total=Sum('number_of_days'))['total'] or 0

                # Pending days (PENDING approval in current year)
                pending = LeaveRequest.objects.filter(
                    employee=emp,
                    leave_type=lt,
                    status=LeaveStatus.PENDING,
                    start_date__year=current_year
                ).aggregate(total=Sum('number_of_days'))['total'] or 0

                allowed = lt.days_allowed
                remaining = max(0, allowed - used)

                total_allowed_all += allowed
                total_used_all += used
                total_pending_all += pending
                total_remaining_all += remaining

                type_balances.append({
                    'leave_type_id': lt.id,
                    'name': lt.name,
                    'code': lt.code,
                    'days_allowed': allowed,
                    'used_days': used,
                    'pending_days': pending,
                    'remaining_days': remaining,
                    'utilization_percent': round((used / allowed * 100) if allowed > 0 else 0, 1)
                })

            return {
                'employee_id': emp.id,
                'employee_code': emp.employee_id,
                'full_name': emp.full_name,
                'email': emp.email,
                'department_id': emp.department.id if emp.department else None,
                'department_name': emp.department.name if emp.department else 'Unassigned',
                'designation_title': emp.designation.title if emp.designation else 'General Staff',
                'work_mode': emp.work_mode,
                'employment_status': emp.employment_status,
                'avatar': emp.user.avatar.url if (emp.user and emp.user.avatar) else '',
                'balances': type_balances,
                'total_allowed': total_allowed_all,
                'total_used': total_used_all,
                'total_pending': total_pending_all,
                'total_remaining': total_remaining_all,
            }

        # For CEO / HR / Admin: full org-wide matrix
        if user.role in [Role.CEO, Role.HR, Role.SYSTEM_ADMIN]:
            employees = Employee.objects.filter(employment_status='ACTIVE').select_related('department', 'designation', 'user').order_by('full_name')
            dept_id = request.query_params.get('department_id')
            if dept_id:
                employees = employees.filter(department_id=dept_id)

            emp_summaries = [compute_employee_balance(e) for e in employees]

            org_total_allowed = sum(e['total_allowed'] for e in emp_summaries)
            org_total_used = sum(e['total_used'] for e in emp_summaries)
            org_total_pending = sum(e['total_pending'] for e in emp_summaries)
            org_total_remaining = sum(e['total_remaining'] for e in emp_summaries)

            today = timezone.now().date()
            today_on_leave = Attendance.objects.filter(date=today, status=AttendanceStatus.LEAVE).count()
            pending_requests_count = LeaveRequest.objects.filter(status=LeaveStatus.PENDING).count()

            return Response({
                'is_management': True,
                'leave_types': LeaveTypeSerializer(leave_types, many=True).data,
                'employees': emp_summaries,
                'kpis': {
                    'total_employees': len(emp_summaries),
                    'org_total_allowed': org_total_allowed,
                    'org_total_used': org_total_used,
                    'org_total_pending': org_total_pending,
                    'org_total_remaining': org_total_remaining,
                    'today_on_leave': today_on_leave,
                    'pending_requests_count': pending_requests_count
                }
            })

        # For regular employee: return personal quota
        if not hasattr(user, 'employee_profile'):
            return Response({'error': 'Employee profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        emp_summary = compute_employee_balance(user.employee_profile)
        return Response({
            'is_management': False,
            'leave_types': LeaveTypeSerializer(leave_types, many=True).data,
            'my_summary': emp_summary
        })
