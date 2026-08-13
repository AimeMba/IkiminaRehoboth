# api/serializers/annual_serializers.py
from rest_framework import serializers
from ..models import (
    AnnualClosing,
    MemberAnnualProfit,
    MemberProfitPayout,
    MemberProfitRequest,
)
from ..services.annual_closing_metrics import (
    get_closing_profit_rate_percent,
    get_closing_total_adjusted_capital,
    get_member_profit_rate_percent,
)

class AnnualClosingSerializer(serializers.ModelSerializer):
    closed_by_name = serializers.CharField(source='closed_by.username', read_only=True)
    total_adjusted_capital = serializers.SerializerMethodField()
    profit_rate_percent = serializers.SerializerMethodField()

    class Meta:
        model = AnnualClosing
        fields = (
            'id',
            'year',
            'total_savings',
            'total_income',
            'loan_interest',
            'fines',
            'expenses',
            'net_profit',
            'total_adjusted_capital',
            'profit_rate_percent',
            'total_shares',
            'december_unpaid_deducted_members',
            'policy_version',
            'closed_by',
            'closed_by_name',
            'closed_on',
        )
        read_only_fields = fields  # byose ni read-only

    def get_total_adjusted_capital(self, obj):
        return get_closing_total_adjusted_capital(obj)

    def get_profit_rate_percent(self, obj):
        return float(get_closing_profit_rate_percent(obj))


class MemberAnnualProfitSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    closing_year = serializers.IntegerField(source='closing.year', read_only=True)
    paid_amount = serializers.IntegerField(read_only=True)
    unpaid_amount = serializers.IntegerField(read_only=True)
    profit_rate_percent = serializers.SerializerMethodField()

    class Meta:
        model = MemberAnnualProfit
        fields = (
            'id',
            'member',
            'member_name',
            'closing',
            'closing_year',
            'total_amount',
            'shares',
            'profit',
            'profit_rate_percent',
            'paid_amount',
            'unpaid_amount',
        )
        read_only_fields = fields  # byose ni read-only

    def get_member_name(self, obj):
        if obj.member and obj.member.user:
            return obj.member.user.get_full_name() or obj.member.user.username or obj.member.national_id
        return obj.member.national_id if obj.member else "-"

    def get_profit_rate_percent(self, obj):
        return float(get_member_profit_rate_percent(obj))


class MemberProfitPayoutSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    annual_profit_year = serializers.IntegerField(source="annual_profit.closing.year", read_only=True)
    approved_by_name = serializers.CharField(source="approved_by.username", read_only=True)
    available_profit_balance = serializers.SerializerMethodField()

    class Meta:
        model = MemberProfitPayout
        fields = (
            "id",
            "member",
            "member_name",
            "annual_profit",
            "annual_profit_year",
            "amount",
            "paid_on",
            "approved_by",
            "approved_by_name",
            "notes",
            "available_profit_balance",
        )
        read_only_fields = ("approved_by", "approved_by_name", "available_profit_balance")

    def get_member_name(self, obj):
        if obj.member and obj.member.user:
            return obj.member.user.get_full_name() or obj.member.user.username or obj.member.national_id
        return obj.member.national_id if obj.member else "-"

    def get_available_profit_balance(self, obj):
        if obj.annual_profit_id:
            return obj.annual_profit.unpaid_amount
        return obj.member.total_unpaid_profit()

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            validated_data["approved_by"] = request.user
        return super().create(validated_data)


class MemberProfitRequestSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.CharField(source="reviewed_by.username", read_only=True)
    requested_by_name = serializers.SerializerMethodField()
    effective_requested_amount = serializers.IntegerField(read_only=True)
    current_available_profit = serializers.SerializerMethodField()

    class Meta:
        model = MemberProfitRequest
        fields = (
            "id",
            "member",
            "member_name",
            "requested_by",
            "requested_by_name",
            "request_mode",
            "requested_amount",
            "requested_balance",
            "effective_requested_amount",
            "request_notes",
            "requested_on",
            "status",
            "approved_amount",
            "reviewed_by",
            "reviewed_by_name",
            "reviewed_on",
            "review_notes",
            "current_available_profit",
        )
        read_only_fields = (
            "member_name",
            "requested_by_name",
            "requested_balance",
            "effective_requested_amount",
            "requested_on",
            "status",
            "approved_amount",
            "reviewed_by",
            "reviewed_by_name",
            "reviewed_on",
            "review_notes",
            "current_available_profit",
        )

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        if not request or request.method in {"GET", "HEAD", "OPTIONS"}:
            fields["member"].read_only = True
            fields["requested_by"].read_only = True
            return fields

        role = getattr(request.user, "role", "")
        if role == "MEMBER":
            fields["member"].read_only = True
        fields["requested_by"].read_only = True
        return fields

    def get_member_name(self, obj):
        if obj.member and obj.member.user:
            return obj.member.user.get_full_name() or obj.member.user.username or obj.member.national_id
        return obj.member.national_id if obj.member else "-"

    def get_requested_by_name(self, obj):
        if obj.requested_by_id:
            return obj.requested_by.get_full_name() or obj.requested_by.username
        return "-"

    def get_current_available_profit(self, obj):
        return int(obj.member.total_unpaid_profit()) if obj.member_id else 0


class MemberProfitRequestReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[
            MemberProfitRequest.StatusChoices.APPROVED,
            MemberProfitRequest.StatusChoices.REJECTED,
        ]
    )
    approved_amount = serializers.IntegerField(required=False, allow_null=True)
    review_notes = serializers.CharField(required=False, allow_blank=True)

    def validate_approved_amount(self, value):
        if value is None:
            return value
        if int(value) <= 0:
            raise serializers.ValidationError("Approved amount must be greater than zero.")
        return int(value)

