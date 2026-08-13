# active_member_permission.py
from rest_framework.permissions import BasePermission
from rest_framework.exceptions import PermissionDenied


class IsActiveMember(BasePermission):
    """
    Block inactive/exited members from accessing any service.
    """

    def has_permission(self, request, view):

        user = request.user

        if not user or not user.is_authenticated:
            return False

        # Only applies if user is a member
        if hasattr(user, "member_profile"):

            member = user.member_profile

            if not member.is_active:
                raise PermissionDenied(
                    "Access denied. You are no longer an active member."
                )

        return True

