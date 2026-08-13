# api/serializers/auth_serializers.py
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from ..models import MembershipFee, Notification
from ..services.transaction_logger import log_transaction

User = get_user_model()


class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @staticmethod
    def _max_failed_attempts():
        return int(getattr(settings, "AUTH_MAX_FAILED_ATTEMPTS", 3))

    @staticmethod
    def _failed_attempt_window_minutes():
        return int(getattr(settings, "AUTH_FAILED_ATTEMPTS_WINDOW_MINUTES", 10))

    @staticmethod
    def _notify_admins_locked_account(target_user):
        admins = User.objects.filter(role=User.Roles.ADMIN, is_active=True)
        title = "Account Locked"
        message = (
            f"User '{target_user.username}' has been locked after multiple failed login attempts."
        )
        for admin in admins:
            Notification.objects.create(
                user=admin,
                notification_type=Notification.NotificationType.SYSTEM,
                title=title,
                message=message,
            )

    def _handle_failed_login(self, username):
        if not username:
            return
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return

        if user.locked_by_system:
            return
        if not user.is_active:
            return

        now = timezone.now()
        window_minutes = self._failed_attempt_window_minutes()
        max_attempts = self._max_failed_attempts()

        # Count only immediate/consecutive failures in a short time window.
        if (
            not user.failed_login_last_at
            or now - user.failed_login_last_at > timedelta(minutes=window_minutes)
        ):
            user.failed_login_attempts = 0

        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        user.failed_login_last_at = now

        if user.failed_login_attempts >= max_attempts:
            user.locked_by_system = True
            user.locked_at = timezone.now()
            user.is_active = False
            user.save(
                update_fields=[
                    "failed_login_attempts",
                    "failed_login_last_at",
                    "locked_by_system",
                    "locked_at",
                    "is_active",
                ]
            )
            self._notify_admins_locked_account(user)
            return

        user.save(update_fields=["failed_login_attempts", "failed_login_last_at"])

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["role"] = user.role
        return token

    def validate(self, attrs):
        username = attrs.get(self.username_field)
        try:
            data = super().validate(attrs)
        except AuthenticationFailed:
            self._handle_failed_login(username)
            raise

        request = self.context.get("request")
        user = self.user

        if user.locked_by_system:
            raise AuthenticationFailed(
                "Account locked after multiple failed attempts. Please contact system administrator."
            )

        if user.failed_login_attempts:
            user.failed_login_attempts = 0
            user.failed_login_last_at = None
            user.save(update_fields=["failed_login_attempts", "failed_login_last_at"])

        if user.role == "MEMBER":
            member = getattr(user, "member_profile", None)
            if member is None:
                raise AuthenticationFailed("Member profile not found. Contact system administrator.")
            if (
                member.enrollment_type == member.EnrollmentType.NEW
                and not MembershipFee.objects.filter(member=member).exists()
            ):
                raise AuthenticationFailed(
                    "Membership fee must be paid before you can access the system."
                )

        log_transaction(
            user=user,
            transaction_type="SYSTEM",
            action="CREATE",
            related_model="AuthSession",
            related_object_id=user.id,
            description=f"User {user.username} logged in",
            request=request,
        )

        return data
