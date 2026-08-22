from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed

class JWTOrQueryParamAuthentication(JWTAuthentication):
    """
    Extends SimpleJWT's JWTAuthentication to allow passing JWT tokens
    via query parameters (e.g. ?token=... or ?auth_token=...) in addition
    to the standard 'Authorization: Bearer <token>' header.
    Particularly useful for direct browser CSV/PDF downloads and file exports.
    """
    def authenticate(self, request):
        # 1. Try standard header-based JWT authentication first
        header = self.get_header(request)
        if header is not None:
            raw_token = self.get_raw_token(header)
            if raw_token is not None:
                validated_token = self.get_validated_token(raw_token)
                return self.get_user(validated_token), validated_token

        # 2. Fall back to query parameter token (e.g. ?token=... or ?auth_token=...)
        token_param = request.query_params.get('token') or request.query_params.get('auth_token')
        if token_param:
            try:
                validated_token = self.get_validated_token(token_param)
                return self.get_user(validated_token), validated_token
            except (InvalidToken, AuthenticationFailed):
                return None

        return None
