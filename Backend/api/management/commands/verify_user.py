from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

User = get_user_model()


class Command(BaseCommand):
    help = "Manually mark a user's email as verified and activate the account (bypasses email delivery)."

    def add_arguments(self, parser):
        parser.add_argument('email', type=str, help="Email of the user to verify.")
        parser.add_argument(
            '--unverify',
            action='store_true',
            help="Instead of verifying, revoke verification and deactivate the account.",
        )

    def handle(self, *args, **options):
        email = options['email'].lower().strip()
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise CommandError(f"No user found with email '{email}'.")

        if options['unverify']:
            user.is_active = False
            user.is_email_verified = False
            user.save(update_fields=['is_active', 'is_email_verified'])
            self.stdout.write(
                self.style.WARNING(f"User {email} is now unverified and deactivated.")
            )
        else:
            user.is_active = True
            user.is_email_verified = True
            user.email_verification_token = None
            user.save(update_fields=['is_active', 'is_email_verified', 'email_verification_token'])
            self.stdout.write(
                self.style.SUCCESS(f"User {email} is now verified and activated.")
            )
