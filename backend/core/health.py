import logging
from django.http import JsonResponse
from django.db import connection
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)

def health_check(request):
    """
    Lightweight health check endpoint suitable for Render health probes and load balancers.
    Checks database connection responsiveness.
    """
    db_ok = False
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1;")
            row = cursor.fetchone()
            if row and row[0] == 1:
                db_ok = True
    except Exception as e:
        logger.error(f"Health check database ping failed: {e}")
        db_ok = False

    payload = {
        "status": "healthy" if db_ok else "unhealthy",
        "service": "attendance-backend-api",
        "database": "connected" if db_ok else "unavailable"
    }

    http_status = 200 if db_ok else 503
    return JsonResponse(payload, status=http_status)


class HealthCheckAPIView(APIView):
    """
    REST Framework version of the health check endpoint.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        db_ok = False
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1;")
                row = cursor.fetchone()
                if row and row[0] == 1:
                    db_ok = True
        except Exception as e:
            logger.error(f"Health check database ping failed: {e}")
            db_ok = False

        data = {
            "status": "healthy" if db_ok else "unhealthy",
            "service": "attendance-backend-api",
            "version": "1.0.0",
            "database": "connected" if db_ok else "unavailable"
        }

        return Response(
            data,
            status=status.HTTP_200_OK if db_ok else status.HTTP_503_SERVICE_UNAVAILABLE
        )
