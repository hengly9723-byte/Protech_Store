import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()

# Reset password for goodcare8877@gmail.com so it can log in with email/password
email = 'goodcare8877@gmail.com'
new_password = input("Enter new password for %s: " % email)

try:
    user = User.objects.get(email=email)
    user.set_password(new_password)
    user.is_active = True
    user.is_email_verified = True
    user.save()
    print("Password updated successfully for %s" % email)
    print("has_usable_password:", user.has_usable_password())
except User.DoesNotExist:
    print("User not found:", email)
