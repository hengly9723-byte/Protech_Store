import os
import sys
import json
import time

# Set Django settings
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'
sys.path.insert(0, '.')

import django
django.setup()

from payments.bakong import _jwt_expiry, merchant_config

# Check environment variables
token = os.environ.get('BAKONG_TOKEN', '')
email = os.environ.get('BAKONG_EMAIL', '')

print(f"BAKONG_TOKEN set: {bool(token)}")
print(f"BAKONG_EMAIL set: {bool(email)}")

# Check token expiry
if token:
    exp = _jwt_expiry(token)
    print(f"JWT exp claim: {exp}")
    if exp:
        remaining = exp - time.time()
        print(f"Seconds remaining: {remaining:.0f}")
        if remaining <= 0:
            print("STATUS: TOKEN EXPIRED")
        elif remaining < 7 * 24 * 60 * 60:
            days = int(remaining // 86400)
            print(f"STATUS: TOKEN WILL EXPIRE in ~{days} day(s)")
else:
    print("STATUS: No token configured - will return AUTH_CONFIG_ERROR")

# Get merchant config
cfg = merchant_config()
print(f"\nmerchant_config token: '{cfg['token']}'")
print(f"merchant_config email: '{cfg['email']}'")

# Try the API call
import requests
base_url = cfg['base_url'].rstrip('/')
url = f"{base_url}/v1/check_transaction_by_md5"
md5 = "e5d38046acc31dbe138755602867750c"

print(f"\nAttempting API call to: {url}")
print(f"MD5: {md5}")

try:
    # Note: without a real token, this will fail with 401
    resp = requests.post(
        url,
        json={'md5': md5},
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}',
            'X-Device-Id': 'protech-django-payments',
            'X-Request-Id': str(uuid.uuid4()) if 'uuid' in dir() else 'test-id',
        },
        timeout=10,
    )
    print(f"HTTP Status: {resp.status_code}")
    print(f"Response: {resp.text[:500]}")
    
    try:
        data = resp.json()
        print(f"Parsed JSON responseCode: {data.get('responseCode')}")
        print(f"Parsed JSON errorCode: {data.get('errorCode')}")
        print(f"Parsed JSON responseMessage: {data.get('responseMessage')}")
        print(f"Parsed JSON data: {data.get('data')}")
    except Exception as e:
        print(f"Failed to parse JSON: {e}")
        
except Exception as e:
    print(f"Request failed: {e}")