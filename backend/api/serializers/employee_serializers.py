from rest_framework import serializers

from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone

from ..models import Department, Employee, StaffAccountHolderHistory
from ..utils.phone_numbers import normalize_phone_number


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ("id", "name", "base_salary")


class EmployeeSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField(read_only=True)
    member_name = serializers.SerializerMethodField(read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model = Employee
        fields = (
            "id",
            "user",
            "user_name",
            "member",
            "member_name",
            "external_full_name",
            "external_national_id",
            "external_phone",
            "external_email",
            "department",
            "department_name",
            "salary",
            "hired_date",
            "is_active",
        )

    def get_user_name(self, obj):
        if not obj.user:
            return obj.external_full_name or ""
        full_name = obj.user.get_full_name().strip()
        return full_name or obj.user.username

    def get_member_name(self, obj):
        if not obj.member or not obj.member.user:
            return ""
        full_name = obj.member.user.get_full_name().strip()
        return full_name or obj.member.user.username

    def validate(self, attrs):
        user = attrs.get("user", getattr(self.instance, "user", None))
        member = attrs.get("member", getattr(self.instance, "member", None))
        external_full_name = attrs.get(
            "external_full_name",
            getattr(self.instance, "external_full_name", ""),
        ).strip()
        external_national_id = attrs.get(
            "external_national_id",
            getattr(self.instance, "external_national_id", ""),
        ).strip()
        external_phone = attrs.get(
            "external_phone",
            getattr(self.instance, "external_phone", ""),
        ).strip()
        external_email = attrs.get(
            "external_email",
            getattr(self.instance, "external_email", ""),
        ).strip()

        if not user and not member and not external_full_name:
            raise serializers.ValidationError(
                "Employee must have a user account, member profile, or external full name."
            )

        if member and external_full_name:
            raise serializers.ValidationError(
                "Choose one profile source: member profile or external profile."
            )

        if member:
            attrs["external_full_name"] = ""
            attrs["external_national_id"] = ""
            attrs["external_phone"] = ""
            attrs["external_email"] = ""
        else:
            if not user:
                raise serializers.ValidationError("External employee must be linked to a user account.")
            if not external_full_name:
                raise serializers.ValidationError("External employee full name is required.")
            if external_national_id and len(external_national_id) != 16:
                raise serializers.ValidationError("External national ID must be 16 digits.")
            if external_phone:
                try:
                    attrs["external_phone"] = normalize_phone_number(external_phone, required=False)
                except DjangoValidationError as exc:
                    raise serializers.ValidationError({"external_phone": exc.messages})
            if external_email and "@" not in external_email:
                raise serializers.ValidationError("Enter a valid external email.")

        if user and member and member.user_id and user.id != member.user_id:
            raise serializers.ValidationError("Selected user does not match selected member account.")

        return attrs

    def create(self, validated_data):
        # Department defines salary baseline for all employees in that department.
        validated_data["salary"] = validated_data["department"].base_salary
        employee = super().create(validated_data)
        self._sync_staff_holder_history(employee, created=True)
        return employee

    def update(self, instance, validated_data):
        previous_signature = self._holder_signature(instance)
        department = validated_data.get("department", instance.department)
        validated_data["salary"] = department.base_salary
        employee = super().update(instance, validated_data)
        self._sync_staff_holder_history(
            employee,
            created=False,
            previous_signature=previous_signature,
        )
        return employee

    def _holder_signature(self, instance):
        return (
            instance.user_id,
            instance.member_id,
            (instance.external_full_name or "").strip(),
        )

    def _sync_staff_holder_history(self, employee, created=False, previous_signature=None):
        if not employee.user_id:
            return

        actor = getattr(getattr(self, "context", {}).get("request"), "user", None)
        current_signature = self._holder_signature(employee)
        if not created and previous_signature == current_signature:
            return

        StaffAccountHolderHistory.objects.filter(user=employee.user, is_current=True).update(
            is_current=False,
            ended_at=timezone.now(),
        )
        StaffAccountHolderHistory.objects.create(
            user=employee.user,
            employee=employee,
            assigned_by=actor,
            started_at=timezone.now(),
            is_current=True,
        )

