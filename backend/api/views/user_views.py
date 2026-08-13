# api/views/user_views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from django.contrib.auth import get_user_model
from django.db.models import Q

from rest_framework_simplejwt.token_blacklist.models import (
    OutstandingToken,
    BlacklistedToken,
)

from ..models import RoleAssignmentHistory, StaffAccountHolderHistory
from ..permissions.role_permissions import IsAdmin, IsAdminOrManager
from ..serializers.user_management_serializers import (
    UserCreateSerializer,
    UserListSerializer,
    RoleAssignmentHistorySerializer,
    StaffAccountHolderHistorySerializer,
    ProfileUpdateSerializer,
    PasswordChangeSerializer,
)
from ..services.transaction_logger import log_transaction



User = get_user_model()


# -------------------------------
# Admin creates user
# -------------------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdmin])
def admin_create_user(request):
    serializer = UserCreateSerializer(
        data=request.data, context={"request": request}
    )
    if serializer.is_valid():
        user = serializer.save()
        log_transaction(
            user=request.user,
            transaction_type="SYSTEM",
            action="CREATE",
            related_model="User",
            related_object_id=user.id,
            description=f"Admin created user {user.username}",
            request=request,
        )
        return Response(
            {"message": "User created successfully"},
            status=status.HTTP_201_CREATED,
        )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# -------------------------------
# List users
# -------------------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdmin])
def list_users(request):
    users = User.objects.select_related("employee", "employee__member__user").all().order_by(
        "-date_joined"
    )
    serializer = UserListSerializer(users, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdmin])
def list_role_assignment_history(request):
    role = (request.query_params.get("role") or "").upper()
    current_only = str(request.query_params.get("current_only") or "").lower() == "true"

    queryset = RoleAssignmentHistory.objects.select_related(
        "user",
        "user__employee",
        "user__employee__member__user",
        "assigned_by",
    )
    if role in {choice for choice, _ in User.Roles.choices}:
        queryset = queryset.filter(role=role)
    if current_only:
        queryset = queryset.filter(is_current=True)

    serializer = RoleAssignmentHistorySerializer(queryset, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdmin])
def list_current_role_holders(request):
    staff_roles = {
        User.Roles.ADMIN,
        User.Roles.MANAGER,
        User.Roles.TELLER,
        User.Roles.LOAN_OFFICER,
        User.Roles.FINANCE,
        User.Roles.AUDITOR,
    }
    queryset = (
        RoleAssignmentHistory.objects.select_related(
            "user",
            "user__employee",
            "user__employee__member__user",
            "assigned_by",
        )
        .filter(is_current=True, role__in=staff_roles)
        .order_by("role", "user__first_name", "user__last_name", "user__username")
    )
    serializer = RoleAssignmentHistorySerializer(queryset, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdmin])
def list_staff_account_holder_history(request):
    current_only = str(request.query_params.get("current_only") or "").lower() == "true"
    queryset = StaffAccountHolderHistory.objects.select_related(
        "user",
        "employee",
        "employee__member__user",
        "assigned_by",
    )
    if current_only:
        queryset = queryset.filter(is_current=True)

    serializer = StaffAccountHolderHistorySerializer(queryset, many=True)
    return Response(serializer.data)


# -------------------------------
# Users options for Member/Client linking (Admin/Manager)
# -------------------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdminOrManager])
def list_users_options(request):
    role = request.query_params.get("role")
    profile = (request.query_params.get("profile") or "").upper()

    if not role and profile in {User.Roles.MEMBER, User.Roles.CLIENT}:
        role = profile

    users = User.objects.filter(is_active=True)

    if role in {choice for choice, _ in User.Roles.choices}:
        users = users.filter(role=role)

    if role == User.Roles.MEMBER or profile == "MEMBER":
        users = users.filter(member_profile__isnull=True)
    elif role == User.Roles.CLIENT or profile == "CLIENT":
        users = users.filter(client_profile__isnull=True)

    users = users.order_by("username")
    data = [
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.get_full_name() or user.username,
            "role": user.role,
        }
        for user in users
    ]
    return Response(data)


# -------------------------------
# Update user (role / is_active)
# -------------------------------
@api_view(["PATCH"])
@permission_classes([IsAuthenticated, IsAdmin])
def update_user(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"detail": "User not found"}, status=404)

    raw_is_active = request.data.get("is_active", None)
    parsed_is_active = None
    if raw_is_active is not None:
        if isinstance(raw_is_active, bool):
            parsed_is_active = raw_is_active
        elif isinstance(raw_is_active, str) and raw_is_active.lower() in {"true", "false"}:
            parsed_is_active = raw_is_active.lower() == "true"
        else:
            return Response({"detail": "is_active must be a boolean"}, status=400)

    if user.id == request.user.id and parsed_is_active is False:
        return Response(
            {"detail": "You cannot deactivate your own account"},
            status=400,
        )

    if "role" in request.data:
        allowed_roles = {choice for choice, _ in User.Roles.choices}
        requested_role = request.data["role"]
        if requested_role not in allowed_roles:
            return Response({"detail": "Invalid role"}, status=400)
        if requested_role == User.Roles.MANAGER:
            manager_exists = User.objects.filter(role=User.Roles.MANAGER).exclude(id=user.id).exists()
            if manager_exists:
                return Response(
                    {"detail": "Only one MANAGER account is allowed in the system."},
                    status=400,
                )
        if user.id == request.user.id and requested_role != request.user.role:
            return Response(
                {"detail": "You cannot change your own role"},
                status=400,
            )
        user.role = requested_role

    if parsed_is_active is not None:
        user.is_active = parsed_is_active
        if user.is_active:
            user.failed_login_attempts = 0
            user.failed_login_last_at = None
            user.locked_by_system = False
            user.locked_at = None
        if user.is_active is False:
            tokens = OutstandingToken.objects.filter(user=user)
            for token in tokens:
                BlacklistedToken.objects.get_or_create(token=token)

    user.updated_by = request.user
    user.save()
    log_transaction(
        user=request.user,
        transaction_type="SYSTEM",
        action="UPDATE",
        related_model="User",
        related_object_id=user.id,
        description=f"Admin updated user {user.username}",
        request=request,
    )
    return Response({"message": "User updated successfully"})


# -------------------------------
# Delete user
# -------------------------------
@api_view(["DELETE"])
@permission_classes([IsAuthenticated, IsAdmin])
def delete_user(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"detail": "User not found"}, status=404)

    if user.id == request.user.id:
        return Response(
            {"detail": "You cannot delete your own account"}, status=400
        )

    deleted_username = user.username
    user.delete()
    log_transaction(
        user=request.user,
        transaction_type="SYSTEM",
        action="DELETE",
        related_model="User",
        related_object_id=user_id,
        description=f"Admin deleted user {deleted_username}",
        request=request,
    )
    return Response(status=204)


# -------------------------------
# Search users
# -------------------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdmin])
def search_users(request):
    users = User.objects.all()

    search = request.query_params.get("search")
    role = request.query_params.get("role")
    is_active = request.query_params.get("is_active")

    if search:
        users = users.filter(
            Q(username__icontains=search)
            | Q(email__icontains=search)
            | Q(first_name__icontains=search)
            | Q(last_name__icontains=search)
        )

    if role:
        users = users.filter(role=role)

    if is_active is not None:
        users = users.filter(is_active=is_active.lower() == "true")

    serializer = UserListSerializer(users, many=True)
    return Response(serializer.data)


# -------------------------------
# Update own profile
# -------------------------------
@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_profile(request):
    if request.user.role in {"MEMBER", "CLIENT"}:
        return Response(
            {"detail": "Direct profile updates are not allowed. Please submit a request."},
            status=403,
        )
    serializer = ProfileUpdateSerializer(
        request.user, data=request.data, partial=True
    )
    if serializer.is_valid():
        serializer.save()
        log_transaction(
            user=request.user,
            transaction_type="SYSTEM",
            action="UPDATE",
            related_model="UserProfile",
            related_object_id=request.user.id,
            description=f"User {request.user.username} updated profile",
            request=request,
        )
        return Response({"message": "Profile updated successfully"})
    return Response(serializer.errors, status=400)

@api_view(['POST'])

# -------------------------------
# Admin resets password for any user
# -------------------------------
@permission_classes([IsAuthenticated, IsAdmin])
def admin_reset_password(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    serializer = PasswordChangeSerializer(data=request.data)
    if serializer.is_valid():
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        log_transaction(
            user=request.user,
            transaction_type="SYSTEM",
            action="UPDATE",
            related_model="UserPassword",
            related_object_id=user.id,
            description=f"Admin reset password for {user.username}",
            request=request,
        )
        return Response({"message": f"Password for {user.username} reset successfully"})
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


