# api/serializers/member_serializers.py
from rest_framework import serializers
from django.core.exceptions import ValidationError as DjangoValidationError
from django.contrib.auth import get_user_model
from ..models import Member, MembershipFee
from .address_serializers import LocationHierarchySerializer
from ..utils.phone_numbers import normalize_phone_number

User = get_user_model()


class MemberSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.Roles.MEMBER)
    )
    user_username = serializers.CharField(source="user.username", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)
    user_full_name = serializers.SerializerMethodField()
    address_hierarchy = serializers.SerializerMethodField()

    class Meta:
        model = Member
        fields = (
            "id",
            "user",
            "user_username",
            "user_email",
            "user_full_name",
            "enrollment_type",
            "national_id",
            "account_number",
            "phone",
            "joined_date",
            "is_active",
            "address",
            "address_hierarchy",
        )
        read_only_fields = ("is_active", "account_number")

    def get_user_full_name(self, obj):
        full_name = obj.user.get_full_name()
        return full_name if full_name else obj.user.username

    def validate_user(self, value):
        qs = Member.objects.filter(user=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This user already has a member profile.")
        return value

    def validate_national_id(self, value):
        if not value.isdigit() or len(value) != 16:
            raise serializers.ValidationError("National ID must be exactly 16 digits.")
        return value

    def validate_phone(self, value):
        try:
            return normalize_phone_number(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)

    def get_address_hierarchy(self, obj):
        return LocationHierarchySerializer(obj.address).data

    def create(self, validated_data):
        member = super().create(validated_data)
        # New member cannot access the system before paying membership fee.
        if (
            member.enrollment_type == Member.EnrollmentType.NEW
            and not MembershipFee.objects.filter(member=member).exists()
            and member.user.is_active
        ):
            member.user.is_active = False
            member.user.save(update_fields=["is_active"])
        return member

