import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import authenticate, get_user_model
User = get_user_model()

# Create a test user
email = 'testauth@example.com'
password = 'testpassword123'

User.objects.filter(email=email).delete()

user = User.objects.create_user(email=email, password=password, full_name='Test Auth')
user.is_active = True
user.save()

print("User password hash:", user.password)

# Try authenticate with email
auth_user = authenticate(email=email, password=password)
print("authenticate(email=...) result:", auth_user)

# Try authenticate with username
auth_user_2 = authenticate(username=email, password=password)
print("authenticate(username=...) result:", auth_user_2)

# Check password directly
print("user.check_password result:", user.check_password(password))

