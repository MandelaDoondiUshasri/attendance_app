from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)

def custom_exception_handler(exc, context):
    # Call DRF default exception handler first
    response = exception_handler(exc, context)

    if response is not None:
        # Standardize error response structure
        custom_data = {
            'success': False,
            'status_code': response.status_code,
            'message': 'Operation failed',
            'errors': response.data
        }
        # Extract readable string message if available
        if isinstance(response.data, dict):
            if 'detail' in response.data:
                custom_data['message'] = str(response.data['detail'])
            elif 'non_field_errors' in response.data:
                custom_data['message'] = ' '.join(map(str, response.data['non_field_errors']))
        elif isinstance(response.data, list):
            custom_data['message'] = ' '.join(map(str, response.data))

        response.data = custom_data
    else:
        # Log unhandled 500 exceptions cleanly
        logger.error(f"Unhandled Exception: {exc}", exc_info=True)
        response = Response(
            {
                'success': False,
                'status_code': 500,
                'message': 'An unexpected server error occurred. Please try again later or contact your administrator.',
                'errors': {'detail': str(exc) if str(exc) else 'Internal Server Error'}
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    return response
