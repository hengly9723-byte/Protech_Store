from django.test import TestCase
from rest_framework.test import APIClient


class ManualAuthDisabledTests(TestCase):
    def test_register_disabled(self):
        r = APIClient().post('/api/register/', {
            'email': 'manual@example.com',
            'password': 'StrongPassword123!',
        }, format='json')
        self.assertEqual(r.status_code, 410)

    def test_login_disabled(self):
        r = APIClient().post('/api/login/', {
            'email': 'manual@example.com',
            'password': 'StrongPassword123!',
        }, format='json')
        self.assertEqual(r.status_code, 410)

    def test_verify_email_disabled(self):
        r = APIClient().post('/api/verify-email/', {'token': 'anything'}, format='json')
        self.assertEqual(r.status_code, 410)

    def test_resend_verification_disabled(self):
        r = APIClient().post('/api/resend-verification/', {'email': 'manual@example.com'}, format='json')
        self.assertEqual(r.status_code, 410)


class UsersEndpointTests(TestCase):
    def test_users_api_is_read_only(self):
        client = APIClient()
        create = client.post('/api/users/', {
            'email': 'created@example.com',
            'password': 'StrongPassword123!',
        }, format='json')
        self.assertEqual(create.status_code, 405)

        listing = client.get('/api/users/')
        self.assertEqual(listing.status_code, 200)


class GoogleFlowTests(TestCase):
    def test_google_endpoint_still_active(self):
        r = APIClient().post('/api/auth/google/', {}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('token', r.data['error'].lower())