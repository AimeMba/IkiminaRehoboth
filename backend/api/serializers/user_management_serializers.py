from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from ..models import RoleAssignmentHistory, StaffAccountHolderHistory

User = get_user_model()


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    account_category = serializers.ChoiceField(
        choices=["MEMBER_ACCOUNT", "CLIENT_ACCOUNT", "STAFF_ACCOUNT"],
        write_only=True,
        required=False,
        default="STAFF_ACCOUNT",
    )

    class Meta:
        model = User
        fields = [
            "username",
            "password",
            "role",
            "email",
            "first_name",
            "last_name",
            "account_category",
        ]

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        role = attrs.get("role")
        account_category = attrs.get("account_category") or "STAFF_ACCOUNT"
        staff_roles = {
            User.Roles.ADMIN,
            User.Roles.MANAGER,
            User.Roles.TELLER,
            User.Roles.LOAN_OFFICER,
            User.Roles.FINANCE,
            User.Roles.AUDITOR,
        }

        if account_category == "MEMBER_ACCOUNT" and role != User.Roles.MEMBER:
            raise serializers.ValidationError({"role": "Member account must use MEMBER role."})
        if account_category == "CLIENT_ACCOUNT" and role != User.Roles.CLIENT:
            raise serializers.ValidationError({"role": "Client account must use CLIENT role."})
        if account_category == "STAFF_ACCOUNT" and role not in staff_roles:
            raise serializers.ValidationError({"role": "Staff account must use a staff role."})

        if role == User.Roles.MANAGER:
            manager_exists = User.objects.filter(role=User.Roles.MANAGER).exists()
            if manager_exists:
                raise serializers.ValidationError(
                    {"role": "Only one MANAGER account is allowed in the system."}
                )
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        admin_user = request.user if request else None
        validated_data.pop("account_category", None)
        return User.objects.create_user(
            username=validated_data["username"],
            password=validated_data["password"],
            role=validated_data["role"],
            email=validated_data.get("email", ""),
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
            created_by=admin_user,
        )


class UserListSerializer(serializers.ModelSerializer):
    created_by = serializers.CharField(source="created_by.username", read_only=True)
    full_name = serializers.SerializerMethodField()
    holder_name = serializers.CharField(read_only=True)
    holder_type = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "full_name",
            "holder_name",
            "holder_type",
            "email",
            "role",
            "is_active",
            "locked_by_system",
            "failed_login_attempts",
            "failed_login_last_at",
            "locked_at",
            "created_by",
            "date_joined",
        ]

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class RoleAssignmentHistorySerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.SerializerMethodField()
    holder_name = serializers.SerializerMethodField()
    holder_type = serializers.SerializerMethodField()
    email = serializers.CharField(source="user.email", read_only=True)
    assigned_by_name = serializers.SerializerMethodField()

    class Meta:
        model = RoleAssignmentHistory
        fields = [
            "id",
            "role",
            "user",
            "username",
            "full_name",
            "holder_name",
            "holder_type",
            "email",
            "started_at",
            "ended_at",
            "is_current",
            "assigned_by",
            "assigned_by_name",
        ]

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username

    def get_holder_name(self, obj):
        return obj.user.holder_name

    def get_holder_type(self, obj):
        return obj.user.holder_type

    def get_assigned_by_name(self, obj):
        if not obj.assigned_by:
            return "-"
        return obj.assigned_by.get_full_name() or obj.assigned_by.username


class StaffAccountHolderHistorySerializer(serializers.ModelSerializer):
    account_username = serializers.CharField(source="user.username", read_only=True)
    role = serializers.CharField(source="user.role", read_only=True)
    holder_name = serializers.SerializerMethodField()
    holder_type = serializers.SerializerMethodField()
    assigned_by_name = serializers.SerializerMethodField()

    class Meta:
        model = StaffAccountHolderHistory
        fields = [
            "id",
            "user",
            "account_username",
            "role",
            "employee",
            "holder_name",
            "holder_type",
            "started_at",
            "ended_at",
            "is_current",
            "assigned_by_name",
        ]

    def get_holder_name(self, obj):
        if obj.employee.member and obj.employee.member.user:
            return obj.employee.member.user.get_full_name() or obj.employee.member.user.username
        if obj.employee.external_full_name:
            return obj.employee.external_full_name
        if obj.employee.user:
            return obj.employee.user.get_full_name() or obj.employee.user.username
        return obj.user.holder_name

    def get_holder_type(self, obj):
        if obj.employee.member_id:
            return "MEMBER"
        if obj.employee.external_full_name:
            return "EXTERNAL"
        return "STAFF"

    def get_assigned_by_name(self, obj):
        if not obj.assigned_by:
            return "-"
        return obj.assigned_by.get_full_name() or obj.assigned_by.username


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, required=False)
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["username", "email", "first_name", "last_name"]
        extra_kwargs = {"username": {"required": False}}
