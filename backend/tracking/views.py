from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from tracking.engine import handle_loc, handle_stop, get_employee_location
from audit.services import AuditService


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

        # Optional enrichment fields
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

        # Audit log on first location share
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
    Used for session restoration after page refresh.
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
