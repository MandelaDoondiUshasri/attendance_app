from datetime import timedelta
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from tracking.engine import handle_loc, handle_stop, get_employee_location
from tracking.models import EmployeeScreenTime
from tracking.serializers import ScreenTimeHeartbeatSerializer
from employees.models import Employee, EmploymentStatus
from accounts.models import Role
from audit.services import AuditService


def format_screen_time(total_seconds):
    if not total_seconds or total_seconds <= 0:
        return "0h 00m"
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    return f"{hours}h {minutes:02d}m"


class LocUpdateView(APIView):
    """
    POST /api/v1/loc/update/
    Accepts employee GPS location data and persists it.
    Required: lat, lon
    Optional: accuracy, speed, heading
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        lat = request.data.get('lat')
        lon = request.data.get('lon')
        if lat is None or lon is None:
            return Response({'error': 'lat and lon required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            lat = float(lat)
            lon = float(lon)
        except (ValueError, TypeError):
            return Response({'error': 'invalid coordinates'}, status=status.HTTP_400_BAD_REQUEST)

        accuracy = request.data.get('accuracy')
        speed = request.data.get('speed')
        heading = request.data.get('heading')

        if accuracy is not None:
            try:
                accuracy = float(accuracy)
            except (ValueError, TypeError):
                accuracy = None
        if speed is not None:
            try:
                speed = float(speed)
            except (ValueError, TypeError):
                speed = None
        if heading is not None:
            try:
                heading = float(heading)
            except (ValueError, TypeError):
                heading = None

        user = request.user
        img = ''
        try:
            emp = user.employee_profile
            eid = emp.employee_id
            name = emp.full_name
            if emp.profile_photo:
                img = emp.profile_photo.url
            elif user.avatar:
                img = user.avatar.url
        except Exception:
            eid = str(user.id)
            name = user.email
            if user.avatar:
                img = user.avatar.url

        moved, is_new = handle_loc(eid, name, lat, lon, img, accuracy, speed, heading)

        if is_new:
            AuditService.log_action(
                actor=user,
                action='LOCATION_TRACKING_START',
                target_model='Employee',
                target_id=eid,
                new_values={'lat': lat, 'lon': lon},
                reason=f"{name} started sharing live location",
                request=request
            )

        return Response({
            'eid': eid,
            'moved': moved,
            'status': 'live',
            'ts': __import__('time').time()
        }, status=status.HTTP_200_OK)


class LocStatusView(APIView):
    """
    GET /api/v1/loc/status/
    Returns the current employee's tracking state and last-known coordinates.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        try:
            emp = user.employee_profile
            eid = emp.employee_id
        except Exception:
            eid = str(user.id)

        loc = get_employee_location(eid)
        if loc:
            return Response({
                'tracking': True,
                'eid': eid,
                'lat': loc['lat'],
                'lon': loc['lon'],
                'ts': loc['ts'],
                'accuracy': loc.get('accuracy'),
                'status': loc.get('status', 'live')
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'tracking': False,
                'eid': eid,
            }, status=status.HTTP_200_OK)


class LocStopView(APIView):
    """
    POST /api/v1/loc/stop/
    Explicitly marks the employee as offline (on logout or permission revoke).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        try:
            emp = user.employee_profile
            eid = emp.employee_id
            name = emp.full_name
        except Exception:
            eid = str(user.id)
            name = user.email

        handle_stop(eid)

        AuditService.log_action(
            actor=user,
            action='LOCATION_TRACKING_STOP',
            target_model='Employee',
            target_id=eid,
            reason=f"{name} stopped sharing live location",
            request=request
        )

        return Response({'eid': eid, 'status': 'offline'}, status=status.HTTP_200_OK)


class ScreenTimeHeartbeatView(APIView):
    """
    POST /api/v1/tracking/screen-time/heartbeat/
    Records active screen time seconds for the logged-in employee.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not hasattr(user, 'employee_profile'):
            return Response({'status': 'ignored', 'message': 'User is not an employee'}, status=status.HTTP_200_OK)

        serializer = ScreenTimeHeartbeatSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        active_seconds = serializer.validated_data['active_seconds']
        emp = user.employee_profile
        today = timezone.localdate()

        with transaction.atomic():
            record, created = EmployeeScreenTime.objects.select_for_update().get_or_create(
                employee=emp,
                date=today,
                defaults={'active_seconds': active_seconds}
            )
            if not created:
                record.active_seconds += active_seconds
                record.save(update_fields=['active_seconds', 'last_heartbeat', 'updated_at'])

        return Response({
            'status': 'success',
            'today_seconds': record.active_seconds,
            'today_screen_time': format_screen_time(record.active_seconds)
        }, status=status.HTTP_200_OK)


class ScreenTimeSummaryView(APIView):
    """
    GET /api/v1/tracking/screen-time/summary/
    Returns employee screen-time metrics.
    CEO & HR can view all employees; regular employees only see their own metrics.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.localdate()
        week_start = today - timedelta(days=6)
        now = timezone.now()

        # Management view: all employees
        if user.role in [Role.CEO, Role.HR, Role.SYSTEM_ADMIN]:
            employees = Employee.objects.filter(
                employment_status=EmploymentStatus.ACTIVE
            ).select_related('department', 'designation', 'user').order_by('full_name')

            # Pre-fetch screen time records for the last 7 days
            records = EmployeeScreenTime.objects.filter(
                date__gte=week_start,
                date__lte=today
            ).values('employee_id', 'date', 'active_seconds', 'last_heartbeat')

            emp_data_map = {}
            for r in records:
                eid = r['employee_id']
                if eid not in emp_data_map:
                    emp_data_map[eid] = {
                        'today_seconds': 0,
                        'weekly_seconds': 0,
                        'last_heartbeat': None
                    }
                emp_data_map[eid]['weekly_seconds'] += r['active_seconds']
                if r['date'] == today:
                    emp_data_map[eid]['today_seconds'] += r['active_seconds']
                    emp_data_map[eid]['last_heartbeat'] = r['last_heartbeat']

            results = []
            for emp in employees:
                stats = emp_data_map.get(emp.id, {
                    'today_seconds': 0,
                    'weekly_seconds': 0,
                    'last_heartbeat': None
                })
                
                is_online = False
                if stats['last_heartbeat']:
                    is_online = (now - stats['last_heartbeat']).total_seconds() < 120

                avatar_url = None
                if emp.profile_photo:
                    try:
                        avatar_url = emp.profile_photo.url
                    except Exception:
                        avatar_url = None
                elif emp.user.avatar:
                    try:
                        avatar_url = emp.user.avatar.url
                    except Exception:
                        avatar_url = None

                results.append({
                    'employee_id': emp.id,
                    'employee_code': emp.employee_id,
                    'full_name': emp.full_name,
                    'email': emp.email,
                    'department': emp.department.name if emp.department else None,
                    'designation': emp.designation.title if emp.designation else None,
                    'avatar': avatar_url,
                    'today_screen_time': format_screen_time(stats['today_seconds']),
                    'weekly_screen_time': format_screen_time(stats['weekly_seconds']),
                    'today_seconds': stats['today_seconds'],
                    'weekly_seconds': stats['weekly_seconds'],
                    'is_online': is_online,
                    'last_heartbeat': stats['last_heartbeat']
                })

            return Response({
                'count': len(results),
                'results': results
            }, status=status.HTTP_200_OK)

        # Regular employee view: ONLY own data
        elif hasattr(user, 'employee_profile'):
            emp = user.employee_profile
            records = EmployeeScreenTime.objects.filter(
                employee=emp,
                date__gte=week_start,
                date__lte=today
            )
            today_seconds = 0
            weekly_seconds = 0
            for r in records:
                weekly_seconds += r.active_seconds
                if r.date == today:
                    today_seconds += r.active_seconds

            return Response({
                'count': 1,
                'results': [{
                    'employee_id': emp.id,
                    'employee_code': emp.employee_id,
                    'full_name': emp.full_name,
                    'today_screen_time': format_screen_time(today_seconds),
                    'weekly_screen_time': format_screen_time(weekly_seconds),
                    'today_seconds': today_seconds,
                    'weekly_seconds': weekly_seconds,
                    'is_online': True
                }]
            }, status=status.HTTP_200_OK)

        else:
            return Response({'count': 0, 'results': []}, status=status.HTTP_200_OK)
