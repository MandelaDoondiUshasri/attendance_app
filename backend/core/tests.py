from django.test import TestCase, Client
from rest_framework import status

class HealthCheckTestCase(TestCase):
    def setUp(self):
        self.client = Client()

    def test_root_health_check(self):
        """Test /health/ endpoint returns 200 with healthy status."""
        response = self.client.get('/health/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data.get('status'), 'healthy')
        self.assertEqual(data.get('database'), 'connected')

    def test_api_v1_health_check(self):
        """Test /api/v1/health/ endpoint returns 200 with API status payload."""
        response = self.client.get('/api/v1/health/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data.get('status'), 'healthy')
        self.assertEqual(data.get('service'), 'attendance-backend-api')
        self.assertEqual(data.get('database'), 'connected')
