# api/serializers/biometric_serializers.py
from rest_framework import serializers
from ..models import Biometric


class BiometricSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField(read_only=True)
    client_name = serializers.CharField(source="client.full_name", read_only=True)

    class Meta:
        model = Biometric
        fields = (
            'id',
            'owner_type',
            'member',
            'member_name',
            'client',
            'client_name',
            'photo',
            'fingerprint_template',
            'created_at',
        )
        read_only_fields = ("created_at",)
        extra_kwargs = {
            "fingerprint_template": {"write_only": True},
        }

    def validate(self, attrs):
        owner_type = attrs.get("owner_type")
        member = attrs.get("member")
        client = attrs.get("client")

        if owner_type == "MEMBER" and (not member or client):
            raise serializers.ValidationError("MEMBER biometric must link only to a member.")

        if owner_type == "CLIENT" and (not client or member):
            raise serializers.ValidationError("CLIENT biometric must link only to a client.")

        return attrs

    def get_member_name(self, obj):
        if not obj.member or not obj.member.user:
            return ""
        full_name = obj.member.user.get_full_name().strip()
        return full_name or obj.member.user.username


class BiometricVerifySerializer(serializers.Serializer):
    fingerprint_template = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True)
    owner_type = serializers.ChoiceField(
        choices=["MEMBER", "CLIENT"],
        required=False,
        allow_null=True,
    )

