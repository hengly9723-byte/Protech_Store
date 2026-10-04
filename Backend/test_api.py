import requests

base_url = 'http://localhost:8000/api'

# Manual email/password auth has been removed — Google OAuth is the only
# authentication method. These endpoints should all respond 410 Gone.

print("1. Register should be disabled (410)...")
r1 = requests.post(f"{base_url}/register/", json={
    'email': 'whatever@example.com',
    'password': 'StrongPassword123!',
    'full_name': 'Test'
})
print("Register response:", r1.status_code, r1.text)

print("2. Login should be disabled (410)...")
r2 = requests.post(f"{base_url}/login/", json={
    'email': 'whatever@example.com',
    'password': 'StrongPassword123!'
})
print("Login response:", r2.status_code, r2.text)

print("3. Verify-email should be disabled (410)...")
r3 = requests.post(f"{base_url}/verify-email/", json={'token': 'anything'})
print("Verify response:", r3.status_code, r3.text)

print("4. Resend-verification should be disabled (410)...")
r4 = requests.post(f"{base_url}/resend-verification/", json={'email': 'whatever@example.com'})
print("Resend response:", r4.status_code, r4.text)

print("5. Users API should reject POST (405)...")
r5 = requests.post(f"{base_url}/users/", json={
    'email': 'created@example.com',
    'password': 'StrongPassword123!'
})
print("Users POST response:", r5.status_code, r5.text)
