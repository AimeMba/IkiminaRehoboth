from rest_framework import serializers

from ..models import LoanRequest


def calculate_request_interest_total(amount, rate_percent, term_months=1, term_days=None):
    amount_value = float(amount or 0)
    rate_value = float(rate_percent or 0)
    days_value = int(term_days or 0)
    if days_value > 0:
        return amount_value * (rate_value / 30.0) * days_value / 100.0
    months_value = max(int(term_months or 1), 1)
    return amount_value * rate_value * months_value / 100.0


class LoanRequestSerializer(serializers.ModelSerializer):
    owner_name = serializers.SerializerMethodField()
    owner_type = serializers.SerializerMethodField()
    member_national_id = serializers.CharField(source="member.national_id", read_only=True)
    client_account_number = serializers.CharField(source="client.account_number", read_only=True)
    approved_loan_id = serializers.IntegerField(source="approved_loan.id", read_only=True)
    requested_by_name = serializers.SerializerMethodField()
    requested_loan_type_name = serializers.CharField(source="requested_loan_type.name", read_only=True)
    application_form_url = serializers.SerializerMethodField()
    id_copy_url = serializers.SerializerMethodField()
    guarantee_cheque_url = serializers.SerializerMethodField()
    estimated_monthly_interest = serializers.SerializerMethodField()
    estimated_daily_interest = serializers.SerializerMethodField()
    daily_interest_rate = serializers.SerializerMethodField()
    estimated_total_interest = serializers.SerializerMethodField()
    estimated_total_payable = serializers.SerializerMethodField()
    estimated_monthly_installment = serializers.SerializerMethodField()
    term_mode = serializers.SerializerMethodField()
    effective_term_value = serializers.SerializerMethodField()

    class Meta:
        model = LoanRequest
        fields = [
            "id",
            "member",
            "client",
            "owner_name",
            "owner_type",
            "member_national_id",
            "client_account_number",
            "requested_loan_type",
            "requested_loan_type_name",
            "requested_amount",
            "requested_term_months",
            "requested_term_days",
            "term_mode",
            "effective_term_value",
            "estimated_monthly_interest",
            "estimated_daily_interest",
            "daily_interest_rate",
            "estimated_total_interest",
            "estimated_total_payable",
            "estimated_monthly_installment",
            "purpose",
            "application_form",
            "id_copy",
            "guarantee_cheque",
            "application_form_url",
            "id_copy_url",
            "guarantee_cheque_url",
            "requested_on",
            "request_origin",
            "requested_by",
            "requested_by_name",
            "status",
            "reviewed_by",
            "reviewed_on",
            "review_notes",
            "approved_loan_id",
        ]
        read_only_fields = [
            "member",
            "client",
            "owner_name",
            "owner_type",
            "member_national_id",
            "client_account_number",
            "requested_loan_type_name",
            "estimated_monthly_interest",
            "estimated_daily_interest",
            "daily_interest_rate",
            "estimated_total_interest",
            "estimated_total_payable",
            "estimated_monthly_installment",
            "requested_on",
            "request_origin",
            "requested_by",
            "requested_by_name",
            "status",
            "reviewed_by",
            "reviewed_on",
            "review_notes",
            "approved_loan_id",
        ]

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

    def validate_requested_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Requested amount must be greater than zero.")
        return value

    def validate_requested_term_months(self, value):
        if value <= 0:
            raise serializers.ValidationError("Requested term months must be greater than zero.")
        if value > 120:
            raise serializers.ValidationError("Requested term months must be at most 120.")
        return value

    def validate_requested_term_days(self, value):
        if value is None:
            return value
        if value <= 0:
            raise serializers.ValidationError("Requested term days must be greater than zero.")
        if value > 365:
            raise serializers.ValidationError("Requested term days must be at most 365.")
        return value

    def validate_requested_loan_type(self, value):
        if value and not value.is_active:
            raise serializers.ValidationError("Selected loan type is not active.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        days = attrs.get("requested_term_days")
        months = attrs.get("requested_term_months")
        if not days and (months is None or months <= 0):
            raise serializers.ValidationError(
                {"requested_term_months": "Term (months or days) is required."}
            )
        if self.instance is None and not attrs.get("requested_loan_type"):
            raise serializers.ValidationError(
                {"requested_loan_type": "Loan type is required."}
            )
        return attrs

    def get_requested_by_name(self, obj):
        if not obj.requested_by:
            return "-"
        return (
            obj.requested_by.get_full_name()
            or obj.requested_by.username
            or obj.requested_by.email
            or "-"
        )

    def _build_file_url(self, obj, field_name):
        file_obj = getattr(obj, field_name, None)
        if not file_obj:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(file_obj.url)
        return file_obj.url

    def get_application_form_url(self, obj):
        return self._build_file_url(obj, "application_form")

    def get_id_copy_url(self, obj):
        return self._build_file_url(obj, "id_copy")

    def get_guarantee_cheque_url(self, obj):
        return self._build_file_url(obj, "guarantee_cheque")

    def get_estimated_monthly_interest(self, obj):
        if not obj.requested_loan_type:
            return 0
        return int(
            int(obj.requested_amount or 0)
            * float(obj.requested_loan_type.interest_rate)
            / 100
        )

    def get_daily_interest_rate(self, obj):
        if not obj.requested_loan_type:
            return 0
        return float(obj.requested_loan_type.interest_rate) / 30.0

    def get_estimated_daily_interest(self, obj):
        if not obj.requested_loan_type:
            return 0
        return int(int(obj.requested_amount or 0) * self.get_daily_interest_rate(obj) / 100)

    def get_estimated_total_interest(self, obj):
        if not obj.requested_loan_type:
            return 0
        return int(
            calculate_request_interest_total(
                amount=obj.requested_amount,
                rate_percent=obj.requested_loan_type.interest_rate,
                term_months=obj.requested_term_months,
                term_days=obj.requested_term_days,
            )
        )

    def get_estimated_total_payable(self, obj):
        return int(obj.requested_amount or 0) + int(self.get_estimated_total_interest(obj))

    def get_estimated_monthly_installment(self, obj):
        term = int(obj.requested_term_days or obj.requested_term_months or 1)
        if term <= 0:
            return 0
        return int(self.get_estimated_total_payable(obj) / term)

    def get_term_mode(self, obj):
        if int(obj.requested_term_days or 0) > 0:
            return "DAYS"
        return "MONTHS"

    def get_effective_term_value(self, obj):
        return int(obj.requested_term_days or obj.requested_term_months or 1)


class LoanRequestReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[LoanRequest.StatusChoices.APPROVED, LoanRequest.StatusChoices.REJECTED]
    )
    review_notes = serializers.CharField(required=False, allow_blank=True)
    loan_type = serializers.IntegerField(required=False)
    due_date = serializers.DateField(required=False, allow_null=True)

    def validate(self, attrs):
        return attrs
