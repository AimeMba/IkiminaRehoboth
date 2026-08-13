# api/views/auth_views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.throttling import AnonRateThrottle

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from django.contrib.auth import get_user_model

from ..serializers.auth_serializers import MyTokenObtainPairSerializer
from ..serializers.user_serializers import PasswordChangeSerializer
from ..serializers.user_serializers import UserListSerializer
from ..services.transaction_logger import log_transaction



User = get_user_model()


class LoginAnonRateThrottle(AnonRateThrottle):
    scope = "login"


# -------------------------------
# JWT Token
# -------------------------------
class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer
    throttle_classes = [LoginAnonRateThrottle]


# -------------------------------
# Current logged-in user
# -------------------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def current_user(request):
    serializer = UserListSerializer(request.user)
    data = serializer.data
    # Superusers should always be treated as ADMIN in frontend role-based UI.
    data["effective_role"] = "ADMIN" if request.user.is_superuser else data.get("role")
    data["is_superuser"] = request.user.is_superuser
    return Response(data)


# -------------------------------
# Change password
# -------------------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    serializer = PasswordChangeSerializer(data=request.data)
    if serializer.is_valid():
        user = request.user
        old_password = serializer.validated_data.get("old_password")
        if not old_password:
            return Response(
                {"detail": "Old password is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not user.check_password(old_password):
            return Response(
                {"detail": "Old password is incorrect"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(serializer.validated_data["new_password"])
        user.save()
        log_transaction(
            user=user,
            transaction_type="SYSTEM",
            action="UPDATE",
            related_model="UserPassword",
            related_object_id=user.id,
            description=f"User {user.username} changed password",
            request=request,
        )
        return Response({"message": "Password updated successfully"})
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# -------------------------------
# Logout
# -------------------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout(request):
    try:
        refresh_token = request.data.get("refresh")
        token = RefreshToken(refresh_token)
        token.blacklist()
        log_transaction(
            user=request.user,
            transaction_type="SYSTEM",
            action="UPDATE",
            related_model="AuthSession",
            related_object_id=request.user.id,
            description=f"User {request.user.username} logged out",
            request=request,
        )
        return Response({"message": "Logged out successfully"})
    except Exception:
        return Response(
            {"detail": "Invalid refresh token"},
            status=status.HTTP_400_BAD_REQUEST,
        )

