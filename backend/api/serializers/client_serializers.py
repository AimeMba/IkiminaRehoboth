# api/serializers/client_serializers.py
from rest_framework import serializers
from django.core.exceptions import ValidationError as DjangoValidationError
from django.contrib.auth import get_user_model
from ..models import Client
from .address_serializers import LocationHierarchySerializer
from ..utils.phone_numbers import normalize_phone_number

User = get_user_model()


class ClientSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True, role=User.Roles.CLIENT)
    )
    user_username = serializers.CharField(source="user.username", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)
    user_full_name = serializers.SerializerMethodField()
    address_hierarchy = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = (
            "id",
            "user",
            "user_username",
            "user_email",
            "user_full_name",
            "full_name",
            "national_id",
            "account_number",
            "phone",
            "created_on",
            "is_active",
            "address",
            "address_hierarchy",
        )
        read_only_fields = ("created_on", "is_active", "account_number")
        extra_kwargs = {
            "full_name": {"required": False, "allow_blank": True},
        }

    def get_user_full_name(self, obj):
        full_name = obj.user.get_full_name() if obj.user else ""
        return full_name if full_name else (obj.user.username if obj.user else "")

    def validate_user(self, value):
        qs = Client.objects.filter(user=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This user already has a client profile.")
        return value

    def validate(self, attrs):
        user = attrs.get("user") or (self.instance.user if self.instance else None)
        if not user:
            raise serializers.ValidationError({"user": "User is required."})

        # Always keep client display name synced with linked user account.
        attrs["full_name"] = user.get_full_name() or user.username
        return attrs

    def validate_national_id(self, value):
        if not value:
            raise serializers.ValidationError("National ID is required.")
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

