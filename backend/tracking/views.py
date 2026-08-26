from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from tracking.engine import handle_loc
class LocUpdateView(APIView):
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
        moved = handle_loc(eid, name, lat, lon, img)
        return Response({'eid': eid, 'moved': moved}, status=status.HTTP_200_OK)
