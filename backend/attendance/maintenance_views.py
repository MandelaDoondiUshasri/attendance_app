from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.utils import timezone
from django.db.models import Q, Count
from datetime import date, datetime, timedelta
import calendar

from accounts.models import Role, User
from employees.models import Employee, Department, Designation, EmploymentStatus
from employees.serializers import EmployeeSerializer, CreateEmployeeSerializer
from attendance.models import (
    Attendance, AttendanceStatus, AttendanceWorkMode, AttendanceMethod,
    DailyAttendanceSubmission, AttendanceBreak, BreakType, MaintenanceGeofence
)
from attendance.serializers import AttendanceSerializer, DailyAttendanceSubmissionSerializer, AttendanceBreakSerializer
from audit.services import AuditService


def get_maintenance_dept():
    """Retrieve or fallback to Maintenance department."""
    dept = Department.objects.filter(Q(code='MAINTENANCE') | Q(code='MAINT') | Q(name__iexact='Maintenance')).first()
    if not dept:
        dept, _ = Department.objects.get_or_create(
            name='Maintenance',
            defaults={'code': 'MAINTENANCE', 'description': 'Maintenance Department'}
        )
    return dept


def check_maintenance_permission(user):
    """
    Ensures user is CEO, HR, SYSTEM_ADMIN, or a SUPERVISOR managing their workforce.
    Returns (authorized: bool, supervisor_dept: Department or None).
    """
    if not user or not user.is_authenticated:
        return False, None

    if user.role in [Role.CEO, Role.HR, Role.SYSTEM_ADMIN]:
        return True, get_maintenance_dept()

    if user.role == Role.SUPERVISOR:
        emp = getattr(user, 'employee_profile', None)
        if emp and emp.department:
            return True, emp.department
        # Fallback to default maintenance department if supervisor has no profile/dept assigned yet
        return True, get_maintenance_dept()

    return False, None

def is_supervisor_clocked_in(user, target_date=None):
    """
    Rule 1 & Section 6:
    Supervisor must have clocked in (check_in is recorded) for the target working day.
    """
    if user.role != Role.SUPERVISOR:
        return True, None

    target = target_date or date.today()
    emp = getattr(user, 'employee_profile', None)
    if not emp:
        return False, "Supervisor has no active employee profile."

    att = Attendance.objects.filter(employee=emp, date=target).first()
    if not att or not att.check_in:
        return False, "Please clock in before taking or submitting worker attendance."

    return True, att


def get_supervisor_workers(user, dept=None):
    """
    Returns ONLY the workers entered by the supervisor.
    Never includes other regular department employees (architects, trainees, engineers, supervisors, etc.).
    """
    if not user or not user.is_authenticated:
        return Employee.objects.none()

    if user.role in [Role.CEO, Role.HR, Role.SYSTEM_ADMIN]:
        qs = Employee.objects.filter(
            Q(is_maintenance_worker=True) |
            Q(created_by__isnull=False) |
            Q(department__code__in=['MAINTENANCE', 'MAINT'])
        ).exclude(user__role__in=[Role.CEO, Role.SYSTEM_ADMIN, Role.HR, Role.SUPERVISOR])
        if dept:
            qs = qs.filter(department=dept)
        return qs

    if user.role == Role.SUPERVISOR:
        # Strictly return workers entered by this supervisor (or subordinates managed by this supervisor)
        # Never includes other regular employees (Architects, Trainees) or other Supervisors
        return Employee.objects.filter(
            Q(created_by=user) | Q(manager__user=user)
        ).exclude(user=user).exclude(user__role__in=[Role.CEO, Role.SYSTEM_ADMIN, Role.HR, Role.SUPERVISOR])

    return Employee.objects.none()


class MaintenanceDashboardView(APIView):
    """
    GET /api/v1/maintenance/dashboard/
    Returns supervisor's clock-in status and maintenance workforce metrics.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        allowed, maint_dept = check_maintenance_permission(request.user)
        if not allowed or not maint_dept:
            return Response({'error': 'Access denied. You do not have Maintenance supervisor permissions.'}, status=status.HTTP_403_FORBIDDEN)

        today = date.today()
        now = timezone.now()

        # 1. Supervisor Clock-In status
        supervisor_emp = getattr(request.user, 'employee_profile', None)
        supervisor_att = Attendance.objects.filter(employee=supervisor_emp, date=today).first() if supervisor_emp else None

        is_clocked_in = bool(supervisor_att and supervisor_att.check_in and not supervisor_att.check_out)
        has_clocked_in_today = bool(supervisor_att and supervisor_att.check_in)
        clock_in_time_str = None
        working_time_str = "00h 00m"

        if supervisor_att and supervisor_att.check_in:
            clock_in_local = timezone.localtime(supervisor_att.check_in)
            clock_in_time_str = clock_in_local.strftime('%I:%M %p')
            # Calculate working time
            end_t = supervisor_att.check_out or now
            seconds = max(0, int((end_t - supervisor_att.check_in).total_seconds()))
            hrs = seconds // 3600
            mins = (seconds % 3600) // 60
            working_time_str = f"{hrs:02d}h {mins:02d}m"

        # 2. Maintenance Workforce metrics for today (strictly supervisor-entered workers)
        active_workers = get_supervisor_workers(request.user, maint_dept).filter(
            employment_status=EmploymentStatus.ACTIVE
        )

        total_workers = active_workers.count()

        today_attendances = Attendance.objects.filter(
            employee__in=active_workers,
            date=today
        ).select_related('employee', 'taken_by')

        present_count = today_attendances.filter(status=AttendanceStatus.PRESENT).count()
        absent_count = today_attendances.filter(status=AttendanceStatus.ABSENT).count()
        late_count = today_attendances.filter(status=AttendanceStatus.LATE).count()
        half_day_count = today_attendances.filter(status=AttendanceStatus.HALF_DAY).count()
        leave_count = today_attendances.filter(status=AttendanceStatus.LEAVE).count()

        marked_worker_ids = set(today_attendances.values_list('employee_id', flat=True))
        not_marked_count = max(0, total_workers - len(marked_worker_ids))

        # Effective present (present + late + half-day)
        effective_present = present_count + late_count + half_day_count
        attendance_pct = round((effective_present / total_workers * 100), 1) if total_workers > 0 else 0.0

        # Submission status
        submission = DailyAttendanceSubmission.objects.filter(department=maint_dept, date=today).first()
        is_submitted = bool(submission) or (active_workers.exists() and today_attendances.filter(is_submitted=True).exists())

        # 3. Lunch break status
        sup_break = AttendanceBreak.objects.filter(employee=supervisor_emp, is_active=True).first() if supervisor_emp else None
        active_worker_breaks = AttendanceBreak.objects.filter(employee__in=active_workers, is_active=True)
        active_breaks_count = active_worker_breaks.count()
        if sup_break:
            active_breaks_count += 1

        dept_on_break = bool(sup_break or active_worker_breaks.exists())
        now_local = timezone.localtime(now)
        lunch_started_str = None
        first_break = sup_break or active_worker_breaks.first()
        if first_break:
            lunch_started_str = timezone.localtime(first_break.start_time).strftime('%I:%M %p')

        # 4. Executive CEO Oversight Data (Supervisors + Geofence + Payroll Overview)
        is_ceo = request.user.role in [Role.CEO, Role.SYSTEM_ADMIN]

        # Active worksite geofence
        geofence = MaintenanceGeofence.objects.first()
        geofence_data = None
        if geofence:
            geofence_data = {
                'id': geofence.id,
                'site_name': geofence.site_name,
                'latitude': geofence.latitude,
                'longitude': geofence.longitude,
                'radius_meters': geofence.radius_meters,
                'is_active': geofence.is_active,
                'updated_at': geofence.updated_at.isoformat() if geofence.updated_at else None,
                'updated_by': geofence.updated_by.email if geofence.updated_by else None
            }

        # Maintenance Supervisors
        supervisors_qs = Employee.objects.filter(
            department=maint_dept,
            user__role=Role.SUPERVISOR
        ).select_related('user', 'designation')

        today_sup_atts = Attendance.objects.filter(
            employee__in=supervisors_qs,
            date=today
        )
        sup_att_map = {att.employee_id: att for att in today_sup_atts}

        supervisors_list = []
        clocked_in_supervisors_count = 0
        for sup in supervisors_qs:
            s_att = sup_att_map.get(sup.id)
            s_is_clocked = bool(s_att and s_att.check_in and not s_att.check_out)
            if s_is_clocked:
                clocked_in_supervisors_count += 1
            s_in_str = timezone.localtime(s_att.check_in).strftime('%I:%M %p') if (s_att and s_att.check_in) else None
            s_out_str = timezone.localtime(s_att.check_out).strftime('%I:%M %p') if (s_att and s_att.check_out) else None
            s_work_str = "00h 00m"
            if s_att and s_att.check_in:
                end_t = s_att.check_out or now
                sec = max(0, int((end_t - s_att.check_in).total_seconds()))
                s_work_str = f"{sec // 3600:02d}h {(sec % 3600) // 60:02d}m"

            supervisors_list.append({
                'id': sup.id,
                'employee_id': sup.employee_id,
                'full_name': sup.full_name,
                'email': sup.user.email if sup.user else sup.email,
                'phone': sup.phone or '-',
                'shift': sup.shift or 'General',
                'status': s_att.status if s_att else 'NOT_MARKED',
                'is_clocked_in': s_is_clocked,
                'clock_in': s_in_str,
                'clock_out': s_out_str,
                'working_time': s_work_str,
                'salary': str(sup.salary or 75000.00)
            })

        # Estimated monthly payroll
        sup_salaries_sum = sum([float(s.salary or 75000.00) for s in supervisors_qs])
        workers_salaries_sum = sum([float(w.salary or 30000.00) for w in active_workers])
        total_estimated_payroll = sup_salaries_sum + workers_salaries_sum

        return Response({
            'is_ceo': is_ceo,
            'department': {
                'id': maint_dept.id,
                'name': maint_dept.name,
                'code': maint_dept.code
            },
            'geofence': geofence_data,
            'lunch_break': {
                'department_on_break': dept_on_break,
                'supervisor_on_break': bool(sup_break),
                'active_breaks_count': active_breaks_count,
                'started_at': lunch_started_str,
                'break_type': 'LUNCH'
            },
            'supervisor_attendance': {
                'is_clocked_in': is_clocked_in,
                'has_clocked_in_today': has_clocked_in_today,
                'status': 'CLOCKED_IN' if is_clocked_in else ('CLOCKED_OUT' if (supervisor_att and supervisor_att.check_out) else 'NOT_CLOCKED_IN'),
                'clock_in': clock_in_time_str,
                'working_time': working_time_str,
                'date': today.strftime('%d %B %Y'),
                'raw_date': today.isoformat()
            },
            'supervisors': supervisors_list,
            'supervisors_metrics': {
                'total_supervisors': len(supervisors_list),
                'clocked_in_today': clocked_in_supervisors_count,
                'attendance_percentage': round((clocked_in_supervisors_count / len(supervisors_list) * 100), 1) if supervisors_list else 0.0
            },
            'workforce': {
                'total_workers': total_workers,
                'present': present_count,
                'absent': absent_count,
                'late': late_count,
                'half_day': half_day_count,
                'on_leave': leave_count,
                'not_marked': not_marked_count,
                'attendance_percentage': attendance_pct,
                'is_submitted': is_submitted,
                'submitted_at': submission.submitted_at.isoformat() if submission else None,
                'submitted_by': submission.submitted_by.email if (submission and submission.submitted_by) else None
            },
            'payroll_overview': {
                'total_staff': len(supervisors_list) + total_workers,
                'supervisors_count': len(supervisors_list),
                'workers_count': total_workers,
                'estimated_monthly_payroll': round(total_estimated_payroll, 2)
            }
        }, status=status.HTTP_200_OK)


class MaintenanceWorkersView(APIView):
    """
    GET  /api/v1/maintenance/workers/  -> List Maintenance workers
    POST /api/v1/maintenance/workers/  -> Add new Maintenance worker
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        allowed, maint_dept = check_maintenance_permission(request.user)
        if not allowed or not maint_dept:
            return Response({'error': 'Access denied. Maintenance permissions required.'}, status=status.HTTP_403_FORBIDDEN)

        role_param = request.query_params.get('role', 'WORKER').upper()
        if request.user.role in [Role.CEO, Role.SYSTEM_ADMIN] and role_param == 'SUPERVISOR':
            queryset = Employee.objects.filter(department=maint_dept, user__role=Role.SUPERVISOR).select_related('user', 'department', 'designation')
        elif request.user.role in [Role.CEO, Role.SYSTEM_ADMIN] and role_param == 'ALL':
            queryset = Employee.objects.filter(
                Q(department=maint_dept) | Q(is_maintenance_worker=True)
            ).exclude(user__role__in=[Role.CEO, Role.SYSTEM_ADMIN, Role.HR]).select_related('user', 'department', 'designation')
        else:
            queryset = get_supervisor_workers(request.user, maint_dept).select_related('user', 'department', 'designation')

        # Filters
        shift_param = request.query_params.get('shift')
        status_param = request.query_params.get('status')
        search_param = request.query_params.get('search')

        if shift_param and shift_param != 'ALL':
            queryset = queryset.filter(shift=shift_param)

        if status_param and status_param != 'ALL':
            queryset = queryset.filter(employment_status=status_param)

        if search_param:
            q = search_param.strip()
            queryset = queryset.filter(
                Q(full_name__icontains=q) |
                Q(employee_id__icontains=q) |
                Q(phone__icontains=q) |
                Q(designation__title__icontains=q)
            )

        # Get today's attendance for these workers to populate "Today's Attendance" column
        today = date.today()
        attendances = Attendance.objects.filter(employee__in=queryset, date=today)
        att_map = {att.employee_id: att for att in attendances}

        serialized = EmployeeSerializer(queryset.order_by('employee_id'), many=True).data

        # Augment with today's attendance status & check-in time
        for item in serialized:
            att = att_map.get(item['id'])
            if att:
                item['today_attendance'] = {
                    'id': att.id,
                    'status': att.status,
                    'check_in': timezone.localtime(att.check_in).strftime('%H:%M') if att.check_in else None,
                    'is_submitted': att.is_submitted
                }
            else:
                item['today_attendance'] = {
                    'id': None,
                    'status': 'NOT_MARKED',
                    'check_in': None,
                    'is_submitted': False
                }

        return Response({'results': serialized, 'count': len(serialized)}, status=status.HTTP_200_OK)

    def post(self, request):
        allowed, maint_dept = check_maintenance_permission(request.user)
        if not allowed or not maint_dept:
            return Response({'error': 'Access denied. Maintenance permissions required.'}, status=status.HTTP_403_FORBIDDEN)

        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        # Lock department to Maintenance and role to EMPLOYEE
        data['department'] = maint_dept.id
        data['role'] = Role.EMPLOYEE

        # Find or create Worker designation under maint_dept
        worker_desg = Designation.objects.filter(
            Q(department=maint_dept, title__iexact='Worker') |
            Q(department=maint_dept, title__iexact='Maintenance Worker') |
            Q(title__iexact='Worker') |
            Q(title__iexact='Maintenance Worker')
        ).first()
        if not worker_desg:
            worker_desg, _ = Designation.objects.get_or_create(
                title='Worker',
                department=maint_dept,
                defaults={'description': 'Maintenance Worker'}
            )

        req_desg_id = data.get('designation')
        if not req_desg_id or not Designation.objects.filter(id=req_desg_id, department=maint_dept).exists():
            data['designation'] = worker_desg.id

        # Handle mobile_number alias to phone
        if 'mobile_number' in data and not data.get('phone'):
            data['phone'] = data['mobile_number']

        if not data.get('email') and data.get('employee_id'):
            clean_id = str(data['employee_id']).lower().strip().replace(' ', '')
            data['email'] = f"{clean_id}.maint@frg.com"
        if not data.get('password'):
            data['password'] = 'Password123!'

        serializer = CreateEmployeeSerializer(data=data, context={'request': request})
        if serializer.is_valid():
            try:
                from decimal import Decimal
                employee = serializer.save()
                # Ensure shift and employment_status
                if 'shift' in data:
                    employee.shift = data['shift']
                if 'employment_status' in data:
                    employee.employment_status = data['employment_status']
                if 'salary' in data and data['salary']:
                    try:
                        employee.salary = Decimal(str(data['salary']))
                    except Exception:
                        pass
                employee.department = maint_dept
                if not employee.designation or employee.designation.department != maint_dept:
                    employee.designation = worker_desg
                employee.created_by = request.user
                sup_profile = getattr(request.user, 'employee_profile', None)
                if sup_profile:
                    employee.manager = sup_profile
                employee.is_maintenance_worker = True
                employee.save()

                AuditService.log_action(
                    actor=request.user,
                    action='CREATE_MAINTENANCE_WORKER',
                    target_model='Employee',
                    target_id=str(employee.id),
                    new_values={'employee_id': employee.employee_id, 'full_name': employee.full_name, 'shift': employee.shift},
                    reason=f"Maintenance worker created: {employee.full_name} ({employee.employee_id})",
                    request=request
                )
                return Response(EmployeeSerializer(employee).data, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MaintenanceWorkerDetailView(APIView):
    """
    GET    /api/v1/maintenance/workers/{id}/
    PUT    /api/v1/maintenance/workers/{id}/
    PATCH  /api/v1/maintenance/workers/{id}/
    DELETE /api/v1/maintenance/workers/{id}/
    """
    permission_classes = [IsAuthenticated]

    def get_object(self, worker_id, maint_dept, user):
        if user.role in [Role.CEO, Role.SYSTEM_ADMIN]:
            emp = Employee.objects.filter(
                Q(id=worker_id),
                Q(department=maint_dept) | Q(is_maintenance_worker=True)
            ).select_related('user', 'department', 'designation').first()
        else:
            emp = get_supervisor_workers(user, maint_dept).filter(id=worker_id).select_related('user', 'department', 'designation').first()
        if not emp:
            raise PermissionDenied("Worker not found or access denied.")
        return emp

    def get(self, request, worker_id):
        allowed, maint_dept = check_maintenance_permission(request.user)
        if not allowed or not maint_dept:
            return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        worker = self.get_object(worker_id, maint_dept, request.user)
        return Response(EmployeeSerializer(worker).data, status=status.HTTP_200_OK)

    def patch(self, request, worker_id):
        allowed, maint_dept = check_maintenance_permission(request.user)
        if not allowed or not maint_dept:
            return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        worker = self.get_object(worker_id, maint_dept, request.user)
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)

        # Do not allow moving worker to other department
        if 'department' in data and str(data['department']) != str(maint_dept.id):
            if request.user.role not in [Role.CEO, Role.HR, Role.SYSTEM_ADMIN]:
                raise PermissionDenied("You cannot reassign workers to another department.")

        serializer = EmployeeSerializer(worker, data=data, partial=True)
        if serializer.is_valid():
            updated_worker = serializer.save()
            AuditService.log_action(
                actor=request.user,
                action='UPDATE_MAINTENANCE_WORKER',
                target_model='Employee',
                target_id=str(updated_worker.id),
                new_values=data,
                reason=f"Maintenance worker updated: {updated_worker.full_name}",
                request=request
            )
            return Response(EmployeeSerializer(updated_worker).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request, worker_id):
        return self.patch(request, worker_id)

    def delete(self, request, worker_id):
        allowed, maint_dept = check_maintenance_permission(request.user)
        if not allowed or not maint_dept:
            return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        worker = self.get_object(worker_id, maint_dept, request.user)
        if worker.user == request.user:
            return Response({'error': 'You cannot delete your own account.'}, status=status.HTTP_400_BAD_REQUEST)

        # Full delete worker & user account if role is EMPLOYEE
        worker_name = worker.full_name
        worker_id_code = worker.employee_id
        worker_user = worker.user
        worker.delete()
        if worker_user and worker_user.role == Role.EMPLOYEE:
            worker_user.delete()

        AuditService.log_action(
            actor=request.user,
            action='DELETE_MAINTENANCE_WORKER',
            target_model='Employee',
            target_id=str(worker_id),
            reason=f"Maintenance worker deleted: {worker_name} ({worker_id_code})",
            request=request
        )
        return Response({'message': f'Worker {worker_name} removed successfully.'}, status=status.HTTP_200_OK)


class MaintenanceAttendanceView(APIView):
    """
    GET  /api/v1/maintenance/attendance/  -> Today's or specific date maintenance worker attendance roster
    POST /api/v1/maintenance/attendance/  -> Take / mark maintenance worker attendance (Present, Late, Absent, Half Day, Leave)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        allowed, maint_dept = check_maintenance_permission(request.user)
        if not allowed or not maint_dept:
            return Response({'error': 'Access denied. Maintenance permissions required.'}, status=status.HTTP_403_FORBIDDEN)

        date_str = request.query_params.get('date')
        target_date = date.fromisoformat(date_str) if date_str else date.today()

        # Check clock-in rule (for informational flag, or if today)
        is_clocked, supervisor_att = is_supervisor_clocked_in(request.user, target_date)

        # Get all active maintenance workers (Rule 2: entered by supervisor)
        active_workers = get_supervisor_workers(request.user, maint_dept).filter(
            employment_status=EmploymentStatus.ACTIVE
        ).order_by('employee_id')

        # Existing attendances for target_date
        attendances = Attendance.objects.filter(
            employee__in=active_workers,
            date=target_date
        ).select_related('employee', 'taken_by')

        att_map = {att.employee_id: att for att in attendances}

        # Check if attendance is submitted
        submission = DailyAttendanceSubmission.objects.filter(department=maint_dept, date=target_date).first()
        is_submitted = bool(submission) or (attendances.exists() and attendances.filter(is_submitted=True).exists())

        # Active breaks for target date
        active_breaks = AttendanceBreak.objects.filter(employee__in=active_workers, is_active=True)
        break_map = {b.employee_id: b for b in active_breaks}
        sup_emp = getattr(request.user, 'employee_profile', None)
        sup_brk = AttendanceBreak.objects.filter(employee=sup_emp, is_active=True).first() if sup_emp else None

        now = timezone.now()
        roster = []
        for worker in active_workers:
            att = att_map.get(worker.id)
            brk = break_map.get(worker.id)
            break_info = None
            if brk:
                diff_m = max(0, int(round((now - brk.start_time).total_seconds() / 60.0)))
                break_info = {
                    'id': brk.id,
                    'break_type': brk.break_type,
                    'start_time': timezone.localtime(brk.start_time).strftime('%I:%M %p'),
                    'duration_minutes': diff_m
                }

            if att:
                check_in_time = timezone.localtime(att.check_in).strftime('%H:%M') if att.check_in else None
                check_out_time = timezone.localtime(att.check_out).strftime('%H:%M') if att.check_out else None
                roster.append({
                    'id': att.id,
                    'worker_id': worker.id,
                    'employee_id': worker.employee_id,
                    'worker_name': worker.full_name,
                    'phone': worker.phone,
                    'designation': worker.designation.title if worker.designation else 'Technician',
                    'shift': worker.shift or 'Morning',
                    'date': target_date.isoformat(),
                    'status': att.status,
                    'check_in': check_in_time,
                    'check_out': check_out_time,
                    'working_hours': float(att.working_hours or 0.0),
                    'marked_by': att.taken_by.email if att.taken_by else 'Supervisor',
                    'is_submitted': att.is_submitted or is_submitted,
                    'is_on_break': bool(brk),
                    'break_info': break_info
                })
            else:
                roster.append({
                    'id': f"unmarked-{worker.id}",
                    'worker_id': worker.id,
                    'employee_id': worker.employee_id,
                    'worker_name': worker.full_name,
                    'phone': worker.phone,
                    'designation': worker.designation.title if worker.designation else 'Technician',
                    'shift': worker.shift or 'Morning',
                    'date': target_date.isoformat(),
                    'status': 'NOT_MARKED',
                    'check_in': None,
                    'check_out': None,
                    'working_hours': 0.0,
                    'marked_by': None,
                    'is_submitted': is_submitted,
                    'is_on_break': bool(brk),
                    'break_info': break_info
                })

        # Summary
        present_cnt = sum(1 for r in roster if r['status'] == AttendanceStatus.PRESENT)
        absent_cnt = sum(1 for r in roster if r['status'] == AttendanceStatus.ABSENT)
        late_cnt = sum(1 for r in roster if r['status'] == AttendanceStatus.LATE)
        half_day_cnt = sum(1 for r in roster if r['status'] == AttendanceStatus.HALF_DAY)
        leave_cnt = sum(1 for r in roster if r['status'] == AttendanceStatus.LEAVE)
        not_marked_cnt = sum(1 for r in roster if r['status'] == 'NOT_MARKED')

        return Response({
            'date': target_date.isoformat(),
            'formatted_date': target_date.strftime('%d %B %Y'),
            'supervisor_clocked_in': is_clocked,
            'supervisor_break': {
                'is_on_break': bool(sup_brk),
                'start_time': timezone.localtime(sup_brk.start_time).strftime('%I:%M %p') if sup_brk else None,
                'duration_minutes': max(0, int(round((now - sup_brk.start_time).total_seconds() / 60.0))) if sup_brk else 0
            } if sup_brk else {'is_on_break': False, 'start_time': None, 'duration_minutes': 0},
            'lunch_break_active': bool(sup_brk or len(break_map) > 0),
            'active_breaks_count': len(break_map) + (1 if sup_brk else 0),
            'is_submitted': is_submitted,
            'submitted_at': submission.submitted_at.isoformat() if submission else None,
            'submitted_by': submission.submitted_by.email if (submission and submission.submitted_by) else None,
            'summary': {
                'total': len(roster),
                'present': present_cnt,
                'absent': absent_cnt,
                'late': late_cnt,
                'half_day': half_day_cnt,
                'leave': leave_cnt,
                'not_marked': not_marked_cnt
            },
            'workers': roster
        }, status=status.HTTP_200_OK)

    def post(self, request):
        allowed, maint_dept = check_maintenance_permission(request.user)
        if not allowed or not maint_dept:
            return Response({'error': 'Access denied. Maintenance permissions required.'}, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        records = data.get('records') if isinstance(data, dict) and 'records' in data else [data] if isinstance(data, dict) else data

        if not isinstance(records, list) or len(records) == 0:
            return Response({'error': 'No attendance records provided.'}, status=status.HTTP_400_BAD_REQUEST)

        # Rule 1: Supervisor must be clocked in before taking attendance
        first_date_str = records[0].get('date')
        target_date = date.fromisoformat(first_date_str) if first_date_str else date.today()
        clocked_in, err = is_supervisor_clocked_in(request.user, target_date)
        if not clocked_in:
            return Response({'error': err or 'Please clock in before taking worker attendance.'}, status=status.HTTP_403_FORBIDDEN)

        # Edge case: Check if attendance for this date is already submitted and locked
        is_already_submitted = DailyAttendanceSubmission.objects.filter(department=maint_dept, date=target_date).exists()
        if is_already_submitted and request.user.role == Role.SUPERVISOR:
            return Response({
                'error': f'Attendance for {target_date.strftime("%d %B %Y")} has already been submitted and locked. Please use attendance correction to request modifications.'
            }, status=status.HTTP_403_FORBIDDEN)

        saved_records = []
        for item in records:
            worker_id = item.get('worker_id') or item.get('employee_id') or item.get('employee')
            if not worker_id:
                continue

            # Query by integer ID or string employee_id within supervisor-entered workers
            allowed_worker_qs = get_supervisor_workers(request.user, maint_dept)
            if isinstance(worker_id, int) or (isinstance(worker_id, str) and worker_id.isdigit()):
                worker = allowed_worker_qs.filter(id=int(worker_id)).first()
            else:
                worker = allowed_worker_qs.filter(employee_id=str(worker_id)).first()

            if not worker:
                return Response({'error': f'Worker with ID {worker_id} not found in your worker roster.'}, status=status.HTTP_404_NOT_FOUND)

            rec_date_str = item.get('date')
            rec_date = date.fromisoformat(rec_date_str) if rec_date_str else target_date

            status_val = str(item.get('status', AttendanceStatus.PRESENT)).upper()
            if status_val not in AttendanceStatus.values:
                status_val = AttendanceStatus.PRESENT

            # Determine check-in and check-out
            now = timezone.now()
            check_in_raw = item.get('check_in')
            check_out_raw = item.get('check_out')

            check_in_dt = None
            check_out_dt = None

            if check_in_raw:
                time_parts = str(check_in_raw).split(':')
                if len(time_parts) >= 2:
                    h, m = int(time_parts[0]), int(time_parts[1])
                    check_in_dt = timezone.make_aware(datetime.combine(rec_date, datetime.min.time().replace(hour=h, minute=m)))
            elif status_val in [AttendanceStatus.PRESENT, AttendanceStatus.LATE]:
                check_in_dt = timezone.make_aware(datetime.combine(rec_date, datetime.min.time().replace(hour=9, minute=0)))

            if check_out_raw:
                time_parts = str(check_out_raw).split(':')
                if len(time_parts) >= 2:
                    h, m = int(time_parts[0]), int(time_parts[1])
                    check_out_dt = timezone.make_aware(datetime.combine(rec_date, datetime.min.time().replace(hour=h, minute=m)))

            hours = 0.0
            if check_in_dt and check_out_dt:
                hours = round(max(0, (check_out_dt - check_in_dt).total_seconds() / 3600.0), 2)
            elif status_val == AttendanceStatus.PRESENT:
                hours = 8.0 if rec_date < date.today() else 0.0

            # Rule 3: Only one record per worker per date
            att, created = Attendance.objects.get_or_create(
                employee=worker,
                date=rec_date,
                defaults={
                    'status': status_val,
                    'check_in': check_in_dt or now,
                    'check_out': check_out_dt,
                    'working_hours': hours,
                    'work_mode': AttendanceWorkMode.OFFICE,
                    'attendance_method': AttendanceMethod.MANUAL_CORRECTION,
                    'taken_by': request.user  # Rule 5: Marked By
                }
            )
            if not created:
                att.status = status_val
                if check_in_dt:
                    att.check_in = check_in_dt
                att.check_out = check_out_dt
                att.working_hours = hours
                att.taken_by = request.user
                att.save()

            AuditService.log_action(
                actor=request.user,
                action='MARK_MAINTENANCE_ATTENDANCE',
                target_model='Attendance',
                target_id=str(att.id),
                new_values={'worker': worker.employee_id, 'date': str(rec_date), 'status': status_val},
                reason=f"Maintenance attendance marked for {worker.full_name} ({status_val})",
                request=request
            )
            saved_records.append(att)

        return Response({
            'message': f'Attendance successfully recorded for {len(saved_records)} maintenance workers.',
            'count': len(saved_records)
        }, status=status.HTTP_200_OK)


class MaintenanceAttendanceSubmitView(APIView):
    """
    POST /api/v1/maintenance/attendance/submit/
    Submits and locks the daily attendance for the Maintenance Department.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        allowed, maint_dept = check_maintenance_permission(request.user)
        if not allowed or not maint_dept:
            return Response({'error': 'Access denied. Maintenance permissions required.'}, status=status.HTTP_403_FORBIDDEN)

        date_str = request.data.get('date')
        target_date = date.fromisoformat(date_str) if date_str else date.today()

        # Rule 1: Supervisor must be clocked in before submitting attendance
        clocked_in, err = is_supervisor_clocked_in(request.user, target_date)
        if not clocked_in:
            return Response({'error': err or 'Please clock in before submitting worker attendance.'}, status=status.HTTP_403_FORBIDDEN)

        # Get all active maintenance workers entered by supervisor
        active_workers = get_supervisor_workers(request.user, maint_dept).filter(
            employment_status=EmploymentStatus.ACTIVE
        )

        total_workers = active_workers.count()
        if total_workers == 0:
            return Response({'error': 'No active workers found in your workforce roster.'}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()

        # Ensure all workers have an attendance record (mark unrecorded ones as ABSENT)
        for worker in active_workers:
            att, created = Attendance.objects.get_or_create(
                employee=worker,
                date=target_date,
                defaults={
                    'status': AttendanceStatus.ABSENT,
                    'check_in': now,
                    'work_mode': AttendanceWorkMode.OFFICE,
                    'attendance_method': AttendanceMethod.MANUAL_CORRECTION,
                    'taken_by': request.user
                }
            )

        # Mark all as submitted
        attendances = Attendance.objects.filter(employee__in=active_workers, date=target_date)
        attendances.update(
            is_submitted=True,
            submitted_by=request.user,
            submitted_at=now
        )

        present_cnt = attendances.filter(status=AttendanceStatus.PRESENT).count()
        absent_cnt = attendances.filter(status=AttendanceStatus.ABSENT).count()
        late_cnt = attendances.filter(status=AttendanceStatus.LATE).count()
        half_day_cnt = attendances.filter(status=AttendanceStatus.HALF_DAY).count()
        leave_cnt = attendances.filter(status=AttendanceStatus.LEAVE).count()

        # Record DailyAttendanceSubmission
        submission, _ = DailyAttendanceSubmission.objects.update_or_create(
            department=maint_dept,
            date=target_date,
            defaults={
                'submitted_by': request.user,
                'submitted_at': now,
                'total_workers': total_workers,
                'present_count': present_cnt,
                'absent_count': absent_cnt,
                'late_count': late_cnt,
                'leave_count': leave_cnt,
                'half_day_count': half_day_cnt,
                'notes': request.data.get('notes', '')
            }
        )

        AuditService.log_action(
            actor=request.user,
            action='SUBMIT_MAINTENANCE_ATTENDANCE',
            target_model='DailyAttendanceSubmission',
            target_id=str(submission.id),
            new_values={
                'department': maint_dept.name,
                'date': str(target_date),
                'total': total_workers,
                'present': present_cnt,
                'absent': absent_cnt,
                'late': late_cnt,
                'leave': leave_cnt
            },
            reason=f"Maintenance daily attendance submitted for {target_date} by {request.user.email}",
            request=request
        )

        return Response({
            'message': 'Attendance Submitted Successfully',
            'submission': {
                'id': submission.id,
                'department': maint_dept.name,
                'date': target_date.isoformat(),
                'formatted_date': target_date.strftime('%d %B %Y'),
                'submitted_by': request.user.email,
                'submitted_at': now.isoformat(),
                'summary': {
                    'total_workers': total_workers,
                    'present': present_cnt,
                    'absent': absent_cnt,
                    'late': late_cnt,
                    'leave': leave_cnt,
                    'half_day': half_day_cnt
                }
            }
        }, status=status.HTTP_200_OK)


class MaintenanceAttendanceSummaryView(APIView):
    """
    GET /api/v1/maintenance/attendance/summary/
    Daily summary counts for Maintenance department.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        allowed, maint_dept = check_maintenance_permission(request.user)
        if not allowed or not maint_dept:
            return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        date_str = request.query_params.get('date')
        target_date = date.fromisoformat(date_str) if date_str else date.today()

        active_workers = get_supervisor_workers(request.user, maint_dept).filter(
            employment_status=EmploymentStatus.ACTIVE
        )

        total_workers = active_workers.count()

        attendances = Attendance.objects.filter(employee__in=active_workers, date=target_date)

        present = attendances.filter(status=AttendanceStatus.PRESENT).count()
        absent = attendances.filter(status=AttendanceStatus.ABSENT).count()
        late = attendances.filter(status=AttendanceStatus.LATE).count()
        half_day = attendances.filter(status=AttendanceStatus.HALF_DAY).count()
        leave = attendances.filter(status=AttendanceStatus.LEAVE).count()
        recorded = attendances.count()
        not_marked = max(0, total_workers - recorded)

        submission = DailyAttendanceSubmission.objects.filter(department=maint_dept, date=target_date).first()

        return Response({
            'date': target_date.isoformat(),
            'formatted_date': target_date.strftime('%d %B %Y'),
            'total_workers': total_workers,
            'present': present,
            'absent': absent,
            'late': late,
            'half_day': half_day,
            'on_leave': leave,
            'not_marked': not_marked,
            'is_submitted': bool(submission),
            'submitted_at': submission.submitted_at.isoformat() if submission else None,
            'submitted_by': submission.submitted_by.email if (submission and submission.submitted_by) else None
        }, status=status.HTTP_200_OK)


class MaintenanceAttendanceHistoryView(APIView):
    """
    GET /api/v1/maintenance/attendance/history/
    Historical attendance with filters (Today, Yesterday, This Week, This Month, Custom Date Range, Worker, Status, Shift).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        allowed, maint_dept = check_maintenance_permission(request.user)
        if not allowed or not maint_dept:
            return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        today = date.today()

        # Date range handling
        range_preset = request.query_params.get('range', 'this_month')
        start_date_param = request.query_params.get('start_date')
        end_date_param = request.query_params.get('end_date')

        if start_date_param and end_date_param:
            start_d = date.fromisoformat(start_date_param)
            end_d = date.fromisoformat(end_date_param)
        elif range_preset == 'today':
            start_d = today
            end_d = today
        elif range_preset == 'yesterday':
            start_d = today - timedelta(days=1)
            end_d = start_d
        elif range_preset == 'this_week':
            start_d = today - timedelta(days=today.weekday())
            end_d = today
        elif range_preset == 'this_month':
            start_d = today.replace(day=1)
            end_d = today
        else:
            start_d = today.replace(day=1)
            end_d = today

        supervisor_workers = get_supervisor_workers(request.user, maint_dept)
        queryset = Attendance.objects.filter(
            employee__in=supervisor_workers,
            date__gte=start_d,
            date__lte=end_d
        ).select_related('employee', 'employee__designation', 'taken_by').order_by('-date', 'employee__full_name')

        # Filters
        worker_param = request.query_params.get('worker')
        status_param = request.query_params.get('status')
        shift_param = request.query_params.get('shift')

        if worker_param:
            if worker_param.isdigit():
                queryset = queryset.filter(employee_id=int(worker_param))
            else:
                queryset = queryset.filter(
                    Q(employee__full_name__icontains=worker_param) |
                    Q(employee__employee_id__icontains=worker_param)
                )

        if status_param and status_param != 'ALL':
            queryset = queryset.filter(status=status_param)

        if shift_param and shift_param != 'ALL':
            queryset = queryset.filter(employee__shift=shift_param)

        records = []
        for att in queryset:
            check_in_str = timezone.localtime(att.check_in).strftime('%I:%M %p') if att.check_in else '-'
            check_out_str = timezone.localtime(att.check_out).strftime('%I:%M %p') if att.check_out else '-'
            records.append({
                'id': att.id,
                'date': att.date.strftime('%d-%m-%Y'),
                'raw_date': att.date.isoformat(),
                'worker_id': att.employee.id,
                'employee_id': att.employee.employee_id,
                'worker_name': att.employee.full_name,
                'designation': att.employee.designation.title if att.employee.designation else 'Technician',
                'shift': att.employee.shift or 'Morning',
                'status': att.status,
                'check_in': check_in_str,
                'check_out': check_out_str,
                'working_hours': float(att.working_hours or 0.0),
                'marked_by': att.taken_by.first_name or att.taken_by.email if att.taken_by else 'System',
                'is_submitted': att.is_submitted
            })

        return Response({
            'start_date': start_d.isoformat(),
            'end_date': end_d.isoformat(),
            'count': len(records),
            'results': records
        }, status=status.HTTP_200_OK)


class MaintenanceMonthlySummaryView(APIView):
    """
    GET /api/v1/maintenance/reports/ or /api/v1/maintenance/attendance/monthly-summary/
    Monthly breakdown for supervisors and workers (Present, Absent, Late, Leave, Half Day).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        allowed, maint_dept = check_maintenance_permission(request.user)
        if not allowed or not maint_dept:
            return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        today = date.today()
        year = int(request.query_params.get('year', today.year))
        month = int(request.query_params.get('month', today.month))
        role_filter = request.query_params.get('role', 'ALL').upper()

        _, num_days = calendar.monthrange(year, month)
        start_date = date(year, month, 1)
        end_date = date(year, month, num_days)

        is_ceo = request.user.role in [Role.CEO, Role.SYSTEM_ADMIN, Role.HR]

        # Get supervisors and workers based on role_filter
        supervisors = Employee.objects.none()
        if is_ceo and role_filter in ['ALL', 'SUPERVISOR']:
            supervisors = Employee.objects.filter(
                department=maint_dept,
                user__role=Role.SUPERVISOR,
                employment_status=EmploymentStatus.ACTIVE
            ).order_by('employee_id')

        workers = Employee.objects.none()
        if role_filter in ['ALL', 'WORKER']:
            workers = get_supervisor_workers(request.user, maint_dept).filter(
                employment_status=EmploymentStatus.ACTIVE
            ).order_by('employee_id')

        staff_list = []
        for s in supervisors:
            staff_list.append((s, 'SUPERVISOR'))
        for w in workers:
            staff_list.append((w, 'WORKER'))

        all_emps = [item[0] for item in staff_list]
        attendances = Attendance.objects.filter(
            employee__in=all_emps,
            date__gte=start_date,
            date__lte=end_date
        )

        rows = []
        supervisors_count = 0
        workers_count = 0

        for emp, role_type in staff_list:
            if role_type == 'SUPERVISOR':
                supervisors_count += 1
            else:
                workers_count += 1

            w_atts = attendances.filter(employee=emp)
            present_c = w_atts.filter(status=AttendanceStatus.PRESENT).count()
            absent_c = w_atts.filter(status=AttendanceStatus.ABSENT).count()
            late_c = w_atts.filter(status=AttendanceStatus.LATE).count()
            leave_c = w_atts.filter(status=AttendanceStatus.LEAVE).count()
            half_day_c = w_atts.filter(status=AttendanceStatus.HALF_DAY).count()
            total_recorded = w_atts.count()

            # Calculate total working hours
            total_seconds = 0
            for att in w_atts:
                if att.check_in and att.check_out:
                    total_seconds += max(0, int((att.check_out - att.check_in).total_seconds()))
                elif att.check_in and att.date == today:
                    total_seconds += max(0, int((timezone.now() - att.check_in).total_seconds()))
                elif att.status == AttendanceStatus.PRESENT:
                    total_seconds += 8 * 3600
                elif att.status == AttendanceStatus.HALF_DAY:
                    total_seconds += 4 * 3600

            hrs = total_seconds // 3600
            mins = (total_seconds % 3600) // 60

            rows.append({
                'worker_id': emp.id,
                'employee_id': emp.employee_id,
                'worker_name': emp.full_name,
                'role': role_type,
                'designation': emp.designation.title if emp.designation else ('Supervisor' if role_type == 'SUPERVISOR' else 'Maintenance Worker'),
                'shift': emp.shift or 'Morning',
                'present': present_c,
                'absent': absent_c,
                'late': late_c,
                'leave': leave_c,
                'half_day': half_day_c,
                'total_marked': total_recorded,
                'attendance_rate': round(((present_c + late_c + half_day_c) / total_recorded * 100), 1) if total_recorded > 0 else 0.0,
                'total_hours': f"{hrs}h {mins}m"
            })

        month_name = calendar.month_name[month]
        return Response({
            'year': year,
            'month': month,
            'month_name': f"{month_name} {year}",
            'results': rows,
            'total_staff': len(rows),
            'supervisors_count': supervisors_count,
            'workers_count': workers_count
        }, status=status.HTTP_200_OK)


class MaintenancePayrollView(APIView):
    """
    GET /api/v1/maintenance/payslips/
    Executive Pay Slip & Monthly Compensation Engine for Maintenance Supervisors & Workers.
    Available to CEO & SYSTEM_ADMIN.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role not in [Role.CEO, Role.SYSTEM_ADMIN]:
            return Response({
                'error': 'Permission denied. Only CEO and System Administrators can view Maintenance payslips.'
            }, status=status.HTTP_403_FORBIDDEN)

        maint_dept = get_maintenance_dept()
        today = date.today()
        try:
            year = int(request.query_params.get('year', today.year))
            month = int(request.query_params.get('month', today.month))
        except (ValueError, TypeError):
            year = today.year
            month = today.month

        role_filter = request.query_params.get('role', 'ALL').upper()

        from decimal import Decimal
        _, num_days = calendar.monthrange(year, month)
        start_date = date(year, month, 1)
        end_date = date(year, month, num_days)

        # 1. Fetch supervisors & workers
        supervisors = Employee.objects.none()
        if role_filter in ['ALL', 'SUPERVISOR']:
            supervisors = Employee.objects.filter(
                department=maint_dept,
                user__role=Role.SUPERVISOR,
                employment_status=EmploymentStatus.ACTIVE
            ).order_by('employee_id')

        workers = Employee.objects.none()
        if role_filter in ['ALL', 'WORKER']:
            workers = get_supervisor_workers(request.user, maint_dept).filter(
                employment_status=EmploymentStatus.ACTIVE
            ).order_by('employee_id')

        staff_list = []
        for s in supervisors:
            staff_list.append((s, 'SUPERVISOR'))
        for w in workers:
            staff_list.append((w, 'WORKER'))

        all_emps = [item[0] for item in staff_list]
        attendances = Attendance.objects.filter(
            employee__in=all_emps,
            date__gte=start_date,
            date__lte=end_date
        )

        records = []
        total_gross = Decimal('0.00')
        total_deductions = Decimal('0.00')
        total_net = Decimal('0.00')

        for emp, role_type in staff_list:
            base_sal = emp.salary or Decimal('75000.00' if role_type == 'SUPERVISOR' else '30000.00')
            daily_rate = (base_sal / Decimal(num_days)).quantize(Decimal('0.01'))
            half_day_rate = (daily_rate / Decimal('2.00')).quantize(Decimal('0.01'))

            w_atts = attendances.filter(employee=emp)
            present_c = w_atts.filter(status=AttendanceStatus.PRESENT).count()
            late_c = w_atts.filter(status=AttendanceStatus.LATE).count()
            half_day_c = w_atts.filter(status=AttendanceStatus.HALF_DAY).count()
            absent_c = w_atts.filter(status=AttendanceStatus.ABSENT).count()
            leave_c = w_atts.filter(status=AttendanceStatus.LEAVE).count()

            # Deductions
            absent_deduction = (Decimal(absent_c) * daily_rate).quantize(Decimal('0.01'))
            half_day_deduction = (Decimal(half_day_c) * half_day_rate).quantize(Decimal('0.01'))
            emp_deductions = min(base_sal, absent_deduction + half_day_deduction)
            net_pay = max(Decimal('0.00'), base_sal - emp_deductions)

            # Earnings breakdown
            basic = (base_sal * Decimal('0.50')).quantize(Decimal('0.01'))
            hra = (base_sal * Decimal('0.30')).quantize(Decimal('0.01'))
            conveyance = (base_sal * Decimal('0.10')).quantize(Decimal('0.01'))
            allowance = (base_sal - basic - hra - conveyance).quantize(Decimal('0.01'))

            total_gross += base_sal
            total_deductions += emp_deductions
            total_net += net_pay

            month_name = calendar.month_name[month]
            records.append({
                'employee_id': emp.id,
                'employee_code': emp.employee_id,
                'full_name': emp.full_name,
                'email': emp.user.email if emp.user else emp.email,
                'role': role_type,
                'designation': emp.designation.title if emp.designation else ('Supervisor' if role_type == 'SUPERVISOR' else 'Maintenance Worker'),
                'shift': emp.shift or 'Morning',
                'joining_date': emp.joining_date.isoformat() if emp.joining_date else None,
                'bank_account': 'HDFC Bank - Direct Salary Transfer',
                'pan_number': f"ABCDE{emp.id:04d}F",
                'pay_period': f"{month_name} {year}",
                'payslip_number': f"FRG-MNT-{year}{month:02d}-{emp.employee_id}",
                'days_in_month': num_days,
                'days_worked': present_c + late_c + half_day_c,
                'days_present': present_c,
                'days_late': late_c,
                'days_half_day': half_day_c,
                'days_absent': absent_c,
                'days_leave': leave_c,
                'base_salary': str(base_sal),
                'daily_rate': str(daily_rate),
                'earnings': {
                    'basic': str(basic),
                    'hra': str(hra),
                    'conveyance': str(conveyance),
                    'allowances': str(allowance),
                    'total_gross': str(base_sal)
                },
                'deductions': {
                    'absent_deduction': str(absent_deduction),
                    'half_day_deduction': str(half_day_deduction),
                    'total_deductions': str(emp_deductions)
                },
                'net_payable': str(net_pay),
                'payment_status': 'PROCESSED' if (year < today.year or (year == today.year and month < today.month)) else 'READY_FOR_PAYMENT'
            })

        month_name = calendar.month_name[month]
        return Response({
            'year': year,
            'month': month,
            'month_name': f"{month_name} {year}",
            'summary': {
                'total_gross': str(total_gross),
                'total_deductions': str(total_deductions),
                'total_net_payroll': str(total_net),
                'total_staff': len(records),
                'supervisors_count': len([r for r in records if r['role'] == 'SUPERVISOR']),
                'workers_count': len([r for r in records if r['role'] == 'WORKER'])
            },
            'records': records
        }, status=status.HTTP_200_OK)


class MaintenanceBreakStatusView(APIView):
    """
    GET /api/v1/maintenance/breaks/status/
    Returns live lunch break status for the supervisor and all maintenance workers.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        allowed, maint_dept = check_maintenance_permission(request.user)
        if not allowed or not maint_dept:
            return Response({'error': 'Access denied. Maintenance permissions required.'}, status=status.HTTP_403_FORBIDDEN)

        today = date.today()
        now = timezone.now()

        # Supervisor status
        sup_emp = getattr(request.user, 'employee_profile', None)
        sup_break = AttendanceBreak.objects.filter(employee=sup_emp, is_active=True).first() if sup_emp else None

        # Workers status (entered by supervisor)
        active_workers = get_supervisor_workers(request.user, maint_dept).filter(
            employment_status=EmploymentStatus.ACTIVE
        ).order_by('employee_id')

        active_breaks = AttendanceBreak.objects.filter(employee__in=active_workers, is_active=True).select_related('employee')
        break_map = {b.employee_id: b for b in active_breaks}

        today_att = Attendance.objects.filter(employee__in=active_workers, date=today)
        present_worker_ids = set(today_att.filter(status__in=[AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.HALF_DAY]).values_list('employee_id', flat=True))

        workers_status = []
        for worker in active_workers:
            brk = break_map.get(worker.id)
            duration_mins = 0
            start_str = None
            if brk:
                duration_mins = max(0, int(round((now - brk.start_time).total_seconds() / 60.0)))
                start_str = timezone.localtime(brk.start_time).strftime('%I:%M %p')

            workers_status.append({
                'worker_id': worker.id,
                'employee_id': worker.employee_id,
                'name': worker.full_name,
                'designation': worker.designation.title if worker.designation else 'Technician',
                'shift': worker.shift or 'Morning',
                'is_present_today': worker.id in present_worker_ids,
                'is_on_break': bool(brk),
                'break_id': brk.id if brk else None,
                'break_type': brk.break_type if brk else 'LUNCH',
                'start_time': start_str,
                'duration_minutes': duration_mins,
                'notes': brk.notes if brk else None
            })

        active_count = len(break_map)
        if sup_break:
            active_count += 1

        total_workforce_count = active_workers.count() + (1 if sup_emp else 0)
        dept_on_break = bool(sup_break or len(break_map) > 0)

        return Response({
            'department_on_break': dept_on_break,
            'active_breaks_count': active_count,
            'total_workforce': total_workforce_count,
            'supervisor_break': {
                'is_on_break': bool(sup_break),
                'break_id': sup_break.id if sup_break else None,
                'start_time': timezone.localtime(sup_break.start_time).strftime('%I:%M %p') if sup_break else None,
                'duration_minutes': max(0, int(round((now - sup_break.start_time).total_seconds() / 60.0))) if sup_break else 0,
                'break_type': sup_break.break_type if sup_break else 'LUNCH'
            } if sup_break else {
                'is_on_break': False,
                'break_id': None,
                'start_time': None,
                'duration_minutes': 0,
                'break_type': 'LUNCH'
            },
            'workers': workers_status
        }, status=status.HTTP_200_OK)


class MaintenanceBreakPauseView(APIView):
    """
    POST /api/v1/maintenance/breaks/pause/
    Pauses shift for lunch break.
    Supported scopes:
      - 'ALL': Supervisor + all present maintenance workers
      - 'SUPERVISOR_ONLY': Supervisor only
      - 'WORKER': Specific worker(s) (worker_id or worker_ids)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        allowed, maint_dept = check_maintenance_permission(request.user)
        if not allowed or not maint_dept:
            return Response({'error': 'Access denied. Maintenance permissions required.'}, status=status.HTTP_403_FORBIDDEN)

        # Rule 1: Supervisor must be clocked in before pausing for lunch break
        is_clocked, supervisor_att = is_supervisor_clocked_in(request.user)
        if not is_clocked and request.user.role == Role.SUPERVISOR:
            return Response({'error': 'Please clock in before pausing for lunch break.'}, status=status.HTTP_403_FORBIDDEN)

        # Geofence validation on pausing — must be at the worksite to start a break
        geofence = MaintenanceGeofence.objects.filter(is_active=True).first()
        pause_lat = request.data.get('latitude')
        pause_lng = request.data.get('longitude')

        if geofence and geofence.is_active and request.user.role == Role.SUPERVISOR:
            if pause_lat is None or pause_lng is None:
                return Response({
                    'error': 'GPS location is required to start a lunch break. Please enable location permissions on your device.',
                    'geofence_required': True
                }, status=status.HTTP_400_BAD_REQUEST)

            is_inside, dist, allowed_rad = geofence.is_inside_geofence(pause_lat, pause_lng)
            if not is_inside:
                return Response({
                    'error': f"Cannot start lunch break: You are {int(dist)}m away from the maintenance worksite ({geofence.site_name}). You must be within the {allowed_rad}m perimeter.",
                    'distance_meters': int(dist),
                    'allowed_radius_meters': allowed_rad,
                    'site_name': geofence.site_name,
                    'geofence_blocked': True
                }, status=status.HTTP_403_FORBIDDEN)

        scope = request.data.get('scope', 'ALL').upper()
        break_type = request.data.get('break_type', BreakType.LUNCH)
        notes = request.data.get('notes', 'Lunch Break')
        now = timezone.now()
        today = date.today()


        target_employees = []
        sup_emp = getattr(request.user, 'employee_profile', None)

        if scope == 'ALL':
            if sup_emp:
                target_employees.append(sup_emp)
            workers = get_supervisor_workers(request.user, maint_dept).filter(
                employment_status=EmploymentStatus.ACTIVE
            )
            today_atts = {a.employee_id: a for a in Attendance.objects.filter(employee__in=workers, date=today)}
            for w in workers:
                att = today_atts.get(w.id)
                if att and att.status in [AttendanceStatus.ABSENT, AttendanceStatus.LEAVE]:
                    continue
                target_employees.append(w)

        elif scope == 'SUPERVISOR_ONLY':
            if not sup_emp:
                return Response({'error': 'No employee profile associated with supervisor.'}, status=status.HTTP_400_BAD_REQUEST)
            target_employees.append(sup_emp)

        elif scope == 'WORKER':
            worker_id = request.data.get('worker_id')
            worker_ids = request.data.get('worker_ids', [])
            if worker_id:
                worker_ids.append(worker_id)
            if not worker_ids:
                return Response({'error': 'worker_id or worker_ids required for WORKER scope.'}, status=status.HTTP_400_BAD_REQUEST)

            workers = get_supervisor_workers(request.user, maint_dept).filter(
                id__in=worker_ids,
                employment_status=EmploymentStatus.ACTIVE
            )
            target_employees.extend(list(workers))
        else:
            return Response({'error': f"Invalid scope '{scope}'. Use 'ALL', 'SUPERVISOR_ONLY', or 'WORKER'."}, status=status.HTTP_400_BAD_REQUEST)

        paused_count = 0
        for emp in target_employees:
            existing = AttendanceBreak.objects.filter(employee=emp, is_active=True).first()
            if not existing:
                today_att = Attendance.objects.filter(employee=emp, date=today).first()
                AttendanceBreak.objects.create(
                    employee=emp,
                    attendance=today_att,
                    break_type=break_type,
                    start_time=now,
                    is_active=True,
                    initiated_by=request.user,
                    notes=notes
                )
                paused_count += 1

        AuditService.log_action(
            actor=request.user,
            action='PAUSE_LUNCH_BREAK',
            target_model='Department',
            target_id=str(maint_dept.id),
            reason=f"Paused for {break_type} ({scope}): {paused_count} staff paused by {request.user.email}",
            request=request
        )

        return Response({
            'success': True,
            'message': f"Lunch break started. {paused_count} staff member(s) paused.",
            'paused_count': paused_count,
            'scope': scope,
            'start_time': timezone.localtime(now).strftime('%I:%M %p')
        }, status=status.HTTP_200_OK)


class MaintenanceBreakResumeView(APIView):
    """
    POST /api/v1/maintenance/breaks/resume/
    Ends active break and resumes work.
    Supported scopes:
      - 'ALL': Resumes supervisor + all maintenance workers currently on break
      - 'SUPERVISOR_ONLY': Resumes supervisor only
      - 'WORKER': Resumes specific worker(s)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        allowed, maint_dept = check_maintenance_permission(request.user)
        if not allowed or not maint_dept:
            return Response({'error': 'Access denied. Maintenance permissions required.'}, status=status.HTTP_403_FORBIDDEN)

        scope = request.data.get('scope', 'ALL').upper()
        now = timezone.now()
        sup_emp = getattr(request.user, 'employee_profile', None)

        # Geofence validation on resuming lunch break
        geofence = MaintenanceGeofence.objects.filter(is_active=True).first()
        resume_lat = request.data.get('latitude')
        resume_lng = request.data.get('longitude')
        verified_dist = None

        if geofence and geofence.is_active:
            if resume_lat is None or resume_lng is None:
                return Response({
                    'error': 'GPS location is required to resume work from lunch break. Please enable location permissions on your device.',
                    'geofence_required': True
                }, status=status.HTTP_400_BAD_REQUEST)

            is_inside, dist, allowed_rad = geofence.is_inside_geofence(resume_lat, resume_lng)
            if not is_inside:
                return Response({
                    'error': f"Cannot resume from lunch break: You are {int(dist)}m away from the maintenance worksite ({geofence.site_name}). You must return within the {allowed_rad}m perimeter set by the CEO.",
                    'distance_meters': int(dist),
                    'allowed_radius_meters': allowed_rad,
                    'site_name': geofence.site_name,
                    'geofence_blocked': True
                }, status=status.HTTP_403_FORBIDDEN)
            verified_dist = dist

        breaks_to_end = []

        if scope == 'ALL':
            workers = get_supervisor_workers(request.user, maint_dept)
            breaks_to_end = list(AttendanceBreak.objects.filter(employee__in=workers, is_active=True))
            if sup_emp:
                sup_active = AttendanceBreak.objects.filter(employee=sup_emp, is_active=True).first()
                if sup_active and sup_active not in breaks_to_end:
                    breaks_to_end.append(sup_active)

        elif scope == 'SUPERVISOR_ONLY':
            if sup_emp:
                breaks_to_end = list(AttendanceBreak.objects.filter(employee=sup_emp, is_active=True))

        elif scope == 'WORKER':
            worker_id = request.data.get('worker_id')
            worker_ids = request.data.get('worker_ids', [])
            if worker_id:
                worker_ids.append(worker_id)
            if not worker_ids:
                return Response({'error': 'worker_id or worker_ids required for WORKER scope.'}, status=status.HTTP_400_BAD_REQUEST)

            allowed_worker_ids = set(get_supervisor_workers(request.user, maint_dept).values_list('id', flat=True))
            target_ids = [w_id for w_id in worker_ids if int(w_id) in allowed_worker_ids]
            breaks_to_end = list(AttendanceBreak.objects.filter(
                employee_id__in=target_ids,
                is_active=True
            ))
        else:
            return Response({'error': f"Invalid scope '{scope}'."}, status=status.HTTP_400_BAD_REQUEST)

        resumed_count = 0
        for brk in breaks_to_end:
            brk.end_break(
                end_dt=now,
                resume_lat=float(resume_lat) if resume_lat is not None else None,
                resume_lng=float(resume_lng) if resume_lng is not None else None,
                distance=float(verified_dist) if verified_dist is not None else None
            )
            resumed_count += 1

        AuditService.log_action(
            actor=request.user,
            action='RESUME_LUNCH_BREAK',
            target_model='Department',
            target_id=str(maint_dept.id),
            reason=f"Resumed work from lunch break ({scope}): {resumed_count} staff resumed by {request.user.email}",
            request=request
        )

        return Response({
            'success': True,
            'message': f"Work resumed. {resumed_count} staff member(s) active.",
            'resumed_count': resumed_count,
            'scope': scope,
            'end_time': timezone.localtime(now).strftime('%I:%M %p'),
            'distance_meters': int(verified_dist) if verified_dist is not None else 0
        }, status=status.HTTP_200_OK)


class MaintenanceGeofenceView(APIView):
    """
    GET  /api/v1/maintenance/geofence/  -> Get active maintenance worksite geofence
    POST /api/v1/maintenance/geofence/  -> Dynamic update of geofence (CEO / SYSTEM_ADMIN only)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        geofence = MaintenanceGeofence.objects.first()
        if not geofence:
            maint_dept = get_maintenance_dept()
            geofence = MaintenanceGeofence.objects.create(
                department=maint_dept,
                site_name="Maintenance Central Works",
                latitude=17.385044,
                longitude=78.486671,
                radius_meters=100,
                is_active=True
            )

        return Response({
            'site_name': geofence.site_name,
            'latitude': geofence.latitude,
            'longitude': geofence.longitude,
            'radius_meters': geofence.radius_meters,
            'is_active': geofence.is_active,
            'updated_at': geofence.updated_at.isoformat() if geofence.updated_at else None,
            'updated_by': geofence.updated_by.email if geofence.updated_by else None
        }, status=status.HTTP_200_OK)

    def post(self, request):
        if request.user.role not in [Role.CEO, Role.SYSTEM_ADMIN]:
            return Response({
                'error': 'Permission denied. Only the CEO can configure the Maintenance Department geofence.'
            }, status=status.HTTP_403_FORBIDDEN)

        lat = request.data.get('latitude')
        lng = request.data.get('longitude')
        radius = request.data.get('radius_meters')
        site_name = request.data.get('site_name', 'Maintenance Worksite')
        is_active = request.data.get('is_active', True)

        if lat is None or lng is None:
            return Response({'error': 'Latitude and longitude are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            lat = float(lat)
            lng = float(lng)
            radius = int(radius or 100)
            if radius < 5 or radius > 50000:
                return Response({'error': 'Radius must be between 5 and 50,000 meters.'}, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError):
            return Response({'error': 'Invalid latitude, longitude, or radius value.'}, status=status.HTTP_400_BAD_REQUEST)

        maint_dept = get_maintenance_dept()
        geofence = MaintenanceGeofence.objects.first()
        if not geofence:
            geofence = MaintenanceGeofence.objects.create(
                department=maint_dept,
                site_name=site_name,
                latitude=lat,
                longitude=lng,
                radius_meters=radius,
                is_active=is_active,
                updated_by=request.user
            )
        else:
            geofence.site_name = site_name
            geofence.latitude = lat
            geofence.longitude = lng
            geofence.radius_meters = radius
            geofence.is_active = is_active
            geofence.updated_by = request.user
            geofence.save()

        AuditService.log_action(
            actor=request.user,
            action='UPDATE_MAINTENANCE_GEOFENCE',
            target_model='MaintenanceGeofence',
            target_id=str(geofence.id),
            reason=f"CEO updated Maintenance geofence: {site_name} at ({lat}, {lng}) radius: {radius}m",
            request=request
        )

        return Response({
            'success': True,
            'message': 'Maintenance Department geofence updated successfully by CEO.',
            'site_name': geofence.site_name,
            'latitude': geofence.latitude,
            'longitude': geofence.longitude,
            'radius_meters': geofence.radius_meters,
            'is_active': geofence.is_active,
            'updated_at': geofence.updated_at.isoformat(),
            'updated_by': request.user.email
        }, status=status.HTTP_200_OK)


class MaintenanceGeofenceSearchAddressView(APIView):
    """
    GET /api/v1/maintenance/geofence/search-address/?q=<query>
    Multi-provider geocoding engine (Coordinates parser + Esri ArcGIS World Geocoder + OSM Nominatim).
    Accurately locates Indian villages, mandals, landmarks, and street addresses.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response({'results': []}, status=status.HTTP_200_OK)

        import requests
        import re

        # 1. Direct Coordinates parser (e.g. "16.6965, 81.7597")
        coord_match = re.match(r'^\s*([+-]?\d+(?:\.\d+)?)\s*[, ]\s*([+-]?\d+(?:\.\d+)?)\s*$', query)
        if coord_match:
            lat, lng = round(float(coord_match.group(1)), 6), round(float(coord_match.group(2)), 6)
            return Response({'results': [{
                'display_name': f"Coordinates: {lat}, {lng}",
                'name': f"{lat}, {lng}",
                'latitude': lat,
                'longitude': lng,
                'type': 'coordinates'
            }]}, status=status.HTTP_200_OK)

        results = []
        seen = set()

        # 2. Esri ArcGIS World Geocoder (Industry standard for India mandals, villages, and towns)
        try:
            r = requests.get(
                'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates',
                params={'f': 'json', 'singleLine': query, 'maxLocations': 6, 'outFields': 'Match_addr,PlaceName,Type'},
                timeout=6
            )
            if r.status_code == 200:
                for cand in r.json().get('candidates', []):
                    loc = cand.get('location', {})
                    if 'y' in loc and 'x' in loc:
                        lat = round(float(loc['y']), 6)
                        lng = round(float(loc['x']), 6)
                        key = (round(lat, 3), round(lng, 3))
                        if key not in seen:
                            seen.add(key)
                            results.append({
                                'display_name': cand.get('address'),
                                'name': cand.get('attributes', {}).get('PlaceName') or cand.get('address', '').split(',')[0],
                                'latitude': lat,
                                'longitude': lng,
                                'type': cand.get('attributes', {}).get('Type') or 'place'
                            })
        except Exception:
            pass

        # 3. OpenStreetMap Nominatim fallback / supplement
        try:
            r = requests.get(
                'https://nominatim.openstreetmap.org/search',
                params={'format': 'json', 'q': query, 'limit': 5, 'addressdetails': 1},
                headers={'User-Agent': 'FRGAttendance/1.0 (contact@frgattendance.com)'},
                timeout=5
            )
            if r.status_code == 200:
                for item in r.json():
                    lat = round(float(item.get('lat')), 6)
                    lng = round(float(item.get('lon')), 6)
                    key = (round(lat, 3), round(lng, 3))
                    if key not in seen:
                        seen.add(key)
                        results.append({
                            'display_name': item.get('display_name'),
                            'name': item.get('name') or item.get('display_name', '').split(',')[0],
                            'latitude': lat,
                            'longitude': lng,
                            'type': item.get('type') or 'place'
                        })
        except Exception:
            pass

        # 4. If still empty and no country in query, retry Nominatim with India context
        if not results and ',' not in query:
            try:
                r = requests.get(
                    'https://nominatim.openstreetmap.org/search',
                    params={'format': 'json', 'q': f"{query}, India", 'limit': 4, 'addressdetails': 1},
                    headers={'User-Agent': 'FRGAttendance/1.0 (contact@frgattendance.com)'},
                    timeout=5
                )
                if r.status_code == 200:
                    for item in r.json():
                        lat = round(float(item.get('lat')), 6)
                        lng = round(float(item.get('lon')), 6)
                        key = (round(lat, 3), round(lng, 3))
                        if key not in seen:
                            seen.add(key)
                            results.append({
                                'display_name': item.get('display_name'),
                                'name': item.get('name') or item.get('display_name', '').split(',')[0],
                                'latitude': lat,
                                'longitude': lng,
                                'type': item.get('type') or 'place'
                            })
            except Exception:
                pass

        return Response({'results': results}, status=status.HTTP_200_OK)


class MaintenanceGeofenceReverseAddressView(APIView):
    """
    GET /api/v1/maintenance/geofence/reverse-address/?lat=<lat>&lng=<lng>
    Reverse-geocodes coordinates into a human-readable address with ArcGIS and Nominatim fallbacks.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        lat = request.query_params.get('lat')
        lng = request.query_params.get('lng')
        if not lat or not lng:
            return Response({'error': 'lat and lng are required'}, status=status.HTTP_400_BAD_REQUEST)

        import requests

        # 1. Try ArcGIS Reverse Geocoding
        try:
            r = requests.get(
                'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode',
                params={'f': 'json', 'location': f"{lng},{lat}"},
                timeout=5
            )
            if r.status_code == 200:
                data = r.json()
                addr_info = data.get('address', {})
                match_addr = addr_info.get('Match_addr') or addr_info.get('LongLabel')
                if match_addr:
                    place_name = addr_info.get('PlaceName') or match_addr.split(',')[0]
                    return Response({
                        'display_name': match_addr,
                        'name': place_name
                    }, status=status.HTTP_200_OK)
        except Exception:
            pass

        # 2. Try Nominatim Reverse Geocoding
        try:
            resp = requests.get(
                'https://nominatim.openstreetmap.org/reverse',
                params={'format': 'json', 'lat': lat, 'lon': lng},
                headers={'User-Agent': 'FRGAttendance/1.0 (contact@frgattendance.com)'},
                timeout=5
            )
            if resp.status_code == 200:
                data = resp.json()
                disp_name = data.get('display_name', '')
                return Response({
                    'display_name': disp_name,
                    'name': data.get('name', '') or disp_name.split(',')[0]
                }, status=status.HTTP_200_OK)
        except Exception:
            pass

        return Response({'display_name': f"{lat}, {lng}", 'name': f"{lat}, {lng}"}, status=status.HTTP_200_OK)



