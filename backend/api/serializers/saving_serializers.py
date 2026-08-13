from datetime import date
from django.utils import timezone
from rest_framework import serializers
from ..models import SavingCategory, MemberSavingChoice, MonthlySaving, Fine, SavingChoiceChangeRequest, Member


def _saving_due_date(year, month):
    # Payment for month M is due by 5th of month M+1; late starts on 6th.
    if month == 12:
        return date(year + 1, 1, 6)
    return date(year, month + 1, 6)


def _monthly_fine_applicable(month):
    # December exception: handled during annual closing.
    return month != 12


class SavingCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = SavingCategory
        fields = ("id", "name", "monthly_amount", "year")

class MemberSavingChoiceSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(
        source="member.user.get_full_name",
        read_only=True
    )
    category_name = serializers.CharField(source="category.name", read_only=True)
    category_year = serializers.IntegerField(source="category.year", read_only=True)
    category_monthly_amount = serializers.IntegerField(source="category.monthly_amount", read_only=True)

    class Meta:
        model = MemberSavingChoice
        fields = (
            "id",
            "member",
            "member_name",
            "category",
            "category_name",
            "category_year",
            "category_monthly_amount",
            "is_active",
        )
        read_only_fields = ("is_active",)

    def validate(self, attrs):
        member = attrs["member"]
        category = attrs["category"]

        if not member.is_active:
            raise serializers.ValidationError("Inactive member cannot choose saving category.")

        existing_choice = MemberSavingChoice.objects.filter(
            member=member,
            category__year=category.year,
            is_active=True,
        )
        if self.instance:
            existing_choice = existing_choice.exclude(pk=self.instance.pk)

        if existing_choice.exists():
            raise serializers.ValidationError(
                "Member already has an active saving choice for this year."
            )

        return attrs


class MySavingChoiceSelectSerializer(serializers.Serializer):
    category = serializers.PrimaryKeyRelatedField(queryset=SavingCategory.objects.all())


class SavingChoiceChangeRequestSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField(read_only=True)
    current_category_name = serializers.CharField(source="current_category.name", read_only=True)
    requested_category_name = serializers.CharField(source="requested_category.name", read_only=True)
    reviewed_by_username = serializers.CharField(source="reviewed_by.username", read_only=True)
    requested_by_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = SavingChoiceChangeRequest
        fields = (
            "id",
            "member",
            "member_name",
            "year",
            "current_category",
            "current_category_name",
            "requested_category",
            "requested_category_name",
            "reason",
            "request_origin",
            "requested_by",
            "requested_by_name",
            "status",
            "requested_on",
            "reviewed_on",
            "reviewed_by",
            "reviewed_by_username",
            "review_note",
        )
        read_only_fields = (
            "status",
            "requested_on",
            "reviewed_on",
            "reviewed_by",
            "review_note",
            "requested_by",
        )

    def get_member_name(self, obj):
        if not obj.member or not obj.member.user:
            return obj.member.national_id if obj.member else "-"
        return obj.member.user.get_full_name() or obj.member.user.username

    def get_requested_by_name(self, obj):
        if not obj.requested_by_id:
            return "-"
        return obj.requested_by.get_full_name() or obj.requested_by.username


class SavingChoiceChangeRequestCreateSerializer(serializers.Serializer):
    member = serializers.PrimaryKeyRelatedField(queryset=Member.objects.all(), required=False)
    requested_category = serializers.PrimaryKeyRelatedField(queryset=SavingCategory.objects.all())
    reason = serializers.CharField(required=False, allow_blank=True)


class SavingChoiceChangeRequestReviewSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=["APPROVE", "REJECT"])
    review_note = serializers.CharField(required=False, allow_blank=True)

class MonthlySavingSerializer(serializers.ModelSerializer):
    member_id = serializers.IntegerField(
        source="saving_choice.member_id",
        read_only=True
    )
    member_name = serializers.SerializerMethodField()
    category_name = serializers.CharField(source="saving_choice.category.name", read_only=True)
    category_monthly_amount = serializers.IntegerField(
        source="saving_choice.category.monthly_amount",
        read_only=True,
    )
    received_by_username = serializers.CharField(source="received_by.username", read_only=True)
    is_late = serializers.SerializerMethodField()
    late_fine_amount = serializers.SerializerMethodField()
    overdue_unpaid_months = serializers.SerializerMethodField()
    committee_review_required = serializers.SerializerMethodField()

    class Meta:
        model = MonthlySaving
        fields = (
            "id",
            "saving_choice",
            "member_id",
            "month",
            "year",
            "amount_paid",
            "saved_on",
            "received_by",
            "received_by_username",
            "member_name",
            "category_name",
            "category_monthly_amount",
            "is_late",
            "late_fine_amount",
            "overdue_unpaid_months",
            "committee_review_required",
        )
        read_only_fields = ("year", "received_by")

    def validate(self, attrs):
        choice = attrs["saving_choice"]

        if not choice.is_active:
            raise serializers.ValidationError("Saving choice is inactive.")

        if not choice.member.is_active:
            raise serializers.ValidationError("Inactive member cannot deposit savings.")

        return attrs

    def get_member_name(self, obj):
        user = obj.saving_choice.member.user
        full_name = user.get_full_name().strip()
        return full_name or user.username

    def get_is_late(self, obj):
        paid_on = obj.saved_on or timezone.localdate()
        due_date = _saving_due_date(obj.year, obj.month)
        return _monthly_fine_applicable(obj.month) and paid_on >= due_date

    def get_late_fine_amount(self, obj):
        fine = Fine.objects.filter(saving=obj).order_by("-id").first()
        return int(fine.amount) if fine else 0

    def _get_overdue_unpaid_months(self, obj):
        choice = obj.saving_choice
        today = timezone.localdate()
        year = choice.category.year
        if year > today.year:
            return 0
        max_month = 12 if year < today.year else today.month
        paid_months = set(
            MonthlySaving.objects.filter(saving_choice=choice).values_list("month", flat=True)
        )
        overdue = 0
        for month in range(1, max_month + 1):
            if not _monthly_fine_applicable(month):
                continue
            due_date = _saving_due_date(year, month)
            if today >= due_date and month not in paid_months:
                overdue += 1
        return overdue

    def get_overdue_unpaid_months(self, obj):
        return self._get_overdue_unpaid_months(obj)

    def get_committee_review_required(self, obj):
        return self._get_overdue_unpaid_months(obj) >= 2

