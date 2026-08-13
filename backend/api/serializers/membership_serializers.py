from rest_framework import serializers
from django.utils import timezone
from ..models import MembershipFee


class MembershipFeeSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    national_id = serializers.CharField(source="member.national_id", read_only=True)
    account_number = serializers.CharField(source="member.account_number", read_only=True)
    received_by_name = serializers.CharField(source="received_by.username", read_only=True)
    payment_status = serializers.SerializerMethodField()

    class Meta:
        model = MembershipFee
        fields = (
            "id",
            "member",
            "member_name",
            "national_id",
            "account_number",
            "amount",
            "paid_on",
            "received_by",
            "received_by_name",
            "payment_status",
        )
        read_only_fields = ("paid_on", "received_by")

    def get_member_name(self, obj):
        if not obj.member or not obj.member.user:
            return "-"
        return (
            obj.member.user.get_full_name()
            or obj.member.user.username
            or obj.member.national_id
        )

    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user
        member = validated_data["member"]

        if member.enrollment_type != member.EnrollmentType.NEW:
            raise serializers.ValidationError(
                "Membership fee is only required for new members."
            )

        if not member.is_active:
            raise serializers.ValidationError("Inactive member cannot pay membership fee.")

        if MembershipFee.objects.filter(member=member).exists():
            raise serializers.ValidationError("Membership fee for this member already exists.")

        # Save received_by automatically
        validated_data["received_by"] = user
        validated_data["paid_on"] = timezone.localdate()
        return super().create(validated_data)

    def get_payment_status(self, _obj):
        return "PAID"

