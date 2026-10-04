import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()

users = User.objects.all().values('email', 'is_active', 'is_email_verified', 'password')
for u in users:
    unusable = u['password'].startswith('!') if u['password'] else True
    print("  email=%s  active=%s  verified=%s  unusable_pw=%s" % (
        u['email'], u['is_active'], u['is_email_verified'], unusable
    ))
