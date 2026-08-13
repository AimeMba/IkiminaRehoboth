from datetime import timedelta
from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers

from ..models import Loan, LoanRepayment, LoanType


def calculate_loan_interest_total(principal, rate_percent, term_months=1, term_days=None):
    principal_value = float(principal or 0)
    rate_value = float(rate_percent or 0)
    days_value = int(term_days or 0)
    if days_value > 0:
        # Interest rate stored monthly; for short terms convert to per-day rate.
        return principal_value * (rate_value / 30.0) * days_value / 100.0
    months_value = max(int(term_months or 1), 1)
    return principal_value * rate_value * months_value / 100.0


# =====================================================
# LOAN REPAYMENT SERIALIZER
# =====================================================
class LoanRepaymentSerializer(serializers.ModelSerializer):
    loan_owner = serializers.SerializerMethodField()
    loan_owner_type = serializers.SerializerMethodField()
    loan_status = serializers.CharField(source="loan.status", read_only=True)
    loan_type_name = serializers.CharField(source="loan.loan_type.name", read_only=True)
    loan_due_date = serializers.DateField(source="loan.due_date", read_only=True)
    loan_remaining_balance = serializers.SerializerMethodField()

    class Meta:
        model = LoanRepayment
        fields = [
            "id",
            "loan",
            "loan_owner",
            "loan_owner_type",
            "loan_status",
            "loan_type_name",
            "loan_due_date",
            "loan_remaining_balance",
            "amount",
            "principal_amount",
            "interest_amount",
            "paid_on",
            "received_by",
        ]
        read_only_fields = ["paid_on", "received_by"]

    def get_loan_owner(self, obj):
        if obj.loan.member:
            user = obj.loan.member.user
            return user.get_full_name() or user.username or obj.loan.member.national_id
        if obj.loan.client:
            return obj.loan.client.full_name
        return "-"

    def get_loan_owner_type(self, obj):
        if obj.loan.member:
            return "MEMBER"
        if obj.loan.client:
            return "CLIENT"
        return "-"

    def get_loan_remaining_balance(self, obj):
        total_interest = calculate_loan_interest_total(
            principal=obj.loan.principal_amount,
            rate_percent=obj.loan.interest_rate,
            term_months=obj.loan.term_months,
            term_days=obj.loan.term_days,
        )
        total_amount = int(obj.loan.principal_amount + total_interest)
        total_paid = obj.loan.repayments.aggregate(total=Sum("amount"))["total"] or 0
        return total_amount - int(total_paid)

    def validate(self, data):
        principal = data.get("principal_amount", 0)
        interest = data.get("interest_amount", 0)
        amount = data.get("amount", 0)

        if principal + interest != amount:
            raise serializers.ValidationError("Principal + Interest must equal total amount.")

        if amount <= 0 or principal < 0 or interest < 0:
            raise serializers.ValidationError("Repayment amounts must be valid positive values.")

        loan = data["loan"]
        if loan.status == "PAID":
            raise serializers.ValidationError("Loan is already fully paid.")

        principal_paid = loan.repayments.aggregate(total=Sum("principal_amount"))["total"] or 0
        remaining_principal = loan.principal_amount - principal_paid
        if principal > remaining_principal:
            raise serializers.ValidationError("Principal repayment exceeds remaining loan principal.")

        return data

    def create(self, validated_data):
        """
        Save repayment.
        Interest income is auto-recorded at model level.
        """
        request = self.context["request"]
        return LoanRepayment.objects.create(received_by=request.user, **validated_data)


# =====================================================
# LOAN SERIALIZER
# =====================================================
class LoanSerializer(serializers.ModelSerializer):
    loan_type_name = serializers.CharField(source="loan_type.name", read_only=True)
    owner_name = serializers.SerializerMethodField()
    owner_type = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    is_near_due = serializers.SerializerMethodField()
    total_amount = serializers.SerializerMethodField()
    monthly_interest_amount = serializers.SerializerMethodField()
    daily_interest_amount = serializers.SerializerMethodField()
    daily_interest_rate = serializers.SerializerMethodField()
    total_interest_amount = serializers.SerializerMethodField()
    monthly_installment = serializers.SerializerMethodField()
    term_mode = serializers.SerializerMethodField()
    effective_term_value = serializers.SerializerMethodField()
    total_paid = serializers.SerializerMethodField()
    remaining_balance = serializers.SerializerMethodField()
    requested_by_name = serializers.SerializerMethodField()
    request_origin_label = serializers.SerializerMethodField()
    repayments = LoanRepaymentSerializer(many=True, read_only=True)

    class Meta:
        model = Loan
        fields = [
            "id",
            "member",
            "client",
            "loan_type",
            "loan_type_name",
            "owner_name",
            "owner_type",
            "principal_amount",
            "term_months",
            "term_days",
            "term_mode",
            "effective_term_value",
            "interest_rate",
            "issued_date",
            "due_date",
            "status",
            "request_origin",
            "request_origin_label",
            "requested_by",
            "requested_by_name",
            "is_overdue",
            "is_near_due",
            "total_amount",
            "monthly_interest_amount",
            "daily_interest_amount",
            "daily_interest_rate",
            "total_interest_amount",
            "monthly_installment",
            "total_paid",
            "remaining_balance",
            "repayments",
        ]
        read_only_fields = [
            "interest_rate",
            "issued_date",
            "status",
            "requested_by",
            "requested_by_name",
            "request_origin",
            "request_origin_label",
        ]

    def create(self, validated_data):
        loan_type = validated_data["loan_type"]
        validated_data["interest_rate"] = loan_type.interest_rate
        return super().create(validated_data)

    def validate(self, attrs):
        member = attrs.get("member")
        client = attrs.get("client")

        if bool(member) == bool(client):
            raise serializers.ValidationError(
                "Loan must belong to exactly one owner: member or client."
            )

        if member and not member.is_active:
            raise serializers.ValidationError("Cannot create a loan for inactive member.")

        if client and not client.is_active:
            raise serializers.ValidationError("Cannot create a loan for inactive client.")

        if attrs.get("principal_amount", 0) <= 0:
            raise serializers.ValidationError("Principal amount must be greater than zero.")
        term_days = attrs.get("term_days")
        if term_days:
            if int(term_days) <= 0:
                raise serializers.ValidationError("Term days must be greater than zero.")
            if int(term_days) > 365:
                raise serializers.ValidationError("Term days must be at most 365.")
        elif attrs.get("term_months", 0) <= 0:
            raise serializers.ValidationError("Term months must be greater than zero.")

        due_date = attrs.get("due_date")
        issued_date = attrs.get("issued_date")
        if self.instance and not issued_date:
            issued_date = self.instance.issued_date
        if due_date and issued_date and due_date < issued_date:
            raise serializers.ValidationError("Due date cannot be before issued date.")

        return attrs

    def get_owner_name(self, obj):
        if obj.member and obj.member.user:
            return (
                obj.member.user.get_full_name()
                or obj.member.user.username
                or obj.member.national_id
            )
        if obj.client:
            return obj.client.full_name
        return "-"

    def get_owner_type(self, obj):
        if obj.member:
            return "MEMBER"
        if obj.client:
            return "CLIENT"
        return "-"

    def get_is_overdue(self, obj):
        if not obj.due_date or obj.status == "PAID":
            return False
        return obj.due_date < timezone.localdate()

    def get_is_near_due(self, obj):
        if not obj.due_date or obj.status == "PAID":
            return False
        today = timezone.localdate()
        return today <= obj.due_date <= (today + timedelta(days=7))

    def get_total_amount(self, obj):
        total_interest = self.get_total_interest_amount(obj)
        return int(obj.principal_amount + total_interest)

    def get_monthly_interest_amount(self, obj):
        return int(obj.principal_amount * float(obj.interest_rate) / 100)

    def get_daily_interest_rate(self, obj):
        return float(obj.interest_rate) / 30.0

    def get_daily_interest_amount(self, obj):
        return int(obj.principal_amount * self.get_daily_interest_rate(obj) / 100)

    def get_total_interest_amount(self, obj):
        return int(
            calculate_loan_interest_total(
                principal=obj.principal_amount,
                rate_percent=obj.interest_rate,
                term_months=obj.term_months,
                term_days=obj.term_days,
            )
        )

    def get_monthly_installment(self, obj):
        term = int(obj.term_days or obj.term_months or 1)
        if term <= 0:
            return 0
        return int(self.get_total_amount(obj) / term)

    def get_term_mode(self, obj):
        if int(obj.term_days or 0) > 0:
            return "DAYS"
        return "MONTHS"

    def get_effective_term_value(self, obj):
        return int(obj.term_days or obj.term_months or 1)

    def get_total_paid(self, obj):
        return obj.repayments.aggregate(total=Sum("amount"))["total"] or 0

    def get_remaining_balance(self, obj):
        return self.get_total_amount(obj) - self.get_total_paid(obj)

    def get_requested_by_name(self, obj):
        if not obj.requested_by:
            return "-"
        return (
            obj.requested_by.get_full_name()
            or obj.requested_by.username
            or obj.requested_by.email
            or "-"
        )

    def get_request_origin_label(self, obj):
        if obj.request_origin == Loan.RequestOrigin.SELF:
            return "SELF"
        if obj.request_origin == Loan.RequestOrigin.ON_BEHALF:
            return "ON_BEHALF"
        return "DIRECT"


class LoanTypeOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoanType
        fields = ["id", "name", "interest_rate", "is_active"]

