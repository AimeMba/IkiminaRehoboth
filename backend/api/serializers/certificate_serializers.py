from rest_framework import serializers

from ..models import MemberCertificateApproval


class MemberCertificateApprovalSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    national_id = serializers.CharField(source="member.national_id", read_only=True)
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = MemberCertificateApproval
        fields = (
            "id",
            "member",
            "member_name",
            "national_id",
            "year",
            "approved_by",
            "approved_by_name",
            "approved_on",
        )
        read_only_fields = fields

    def get_member_name(self, obj):
        return obj.member.user.get_full_name() or obj.member.user.username

    def get_approved_by_name(self, obj):
        if not obj.approved_by:
            return None
        return obj.approved_by.get_full_name() or obj.approved_by.username

