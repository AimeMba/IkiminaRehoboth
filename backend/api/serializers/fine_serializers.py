# api/serializers/fine_serializers.py
from decimal import Decimal, ROUND_HALF_UP

from rest_framework import serializers
from django.utils import timezone

from ..models import FineRule, Fine, MemberSavingChoice


class FineRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = FineRule
        fields = (
            "id",
            "name",
            "fine_type",
            "percentage",
            "applies_after_days",
            "is_active",
            "created_on",
        )


class FineSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    rule_name = serializers.CharField(source="rule.name", read_only=True)
    rule_type = serializers.CharField(source="rule.fine_type", read_only=True)

    class Meta:
        model = Fine
        fields = (
            "id",
            "member",
            "member_name",
            "rule",
            "rule_name",
            "rule_type",
            "saving",
            "loan",
            "amount",
            "calculated_on",
            "is_paid",
            "paid_on",
            "is_waived",
            "waived_on",
            "waived_by",
            "waiver_reason",
        )
        read_only_fields = ("waived_on", "waived_by")

    def get_member_name(self, obj):
        if not obj.member or not obj.member.user:
            return "-"
        return (
            obj.member.user.get_full_name()
            or obj.member.user.username
            or obj.member.national_id
        )

    def _get_member_monthly_base(self, member, target_year):
        choice = (
            MemberSavingChoice.objects.select_related("category")
            .filter(
                member=member,
                is_active=True,
                category__year=target_year,
            )
            .order_by("-id")
            .first()
        )
        if not choice:
            raise serializers.ValidationError(
                {
                    "member": (
                        f"Member has no active saving category for year {target_year}. "
                        "All fines must be based on the member monthly saving category "
                        "selected for that year."
                    )
                }
            )
        return Decimal(choice.category.monthly_amount)

    def validate(self, attrs):
        rule = attrs.get("rule") or getattr(self.instance, "rule", None)
        member = attrs.get("member") or getattr(self.instance, "member", None)

        if not rule or not member:
            return attrs

        saving = attrs.get("saving") or getattr(self.instance, "saving", None)
        target_year = saving.year if saving else timezone.localdate().year

        # All member fines are based on selected monthly saving category for the target year.
        base_amount = self._get_member_monthly_base(member, target_year)
        attrs["amount"] = int(
            (base_amount * rule.percentage / Decimal("100")).quantize(
                Decimal("1"), rounding=ROUND_HALF_UP
            )
        )
        attrs["saving"] = None
        attrs["loan"] = None

        is_paid = attrs.get("is_paid", getattr(self.instance, "is_paid", False))
        is_waived = attrs.get("is_waived", getattr(self.instance, "is_waived", False))
        if is_paid and is_waived:
            raise serializers.ValidationError(
                {"is_waived": "A fine cannot be paid and waived at the same time."}
            )

        return attrs
