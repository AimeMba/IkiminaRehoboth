from rest_framework import serializers
from django.db import transaction
from django.utils import timezone

from ..models import (
    MemberExit,
    MemberWithdrawal,
    Income,
    IncomeCategory,
)


class MemberExitSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    national_id = serializers.CharField(source="member.national_id", read_only=True)
    approved_by_name = serializers.CharField(source="approved_by.username", read_only=True)

    class Meta:
        model = MemberExit
        fields = [
            "id",
            "member",
            "member_name",
            "national_id",
            "total_savings",
            "amount_paid",
            "retained_amount",
            "exit_date",
            "approved_by",
            "approved_by_name",
            "notes",
        ]

        read_only_fields = [
            "total_savings",
            "amount_paid",
            "retained_amount",
            "exit_date",
            "approved_by",
        ]

    def get_member_name(self, obj):
        if not obj.member or not obj.member.user:
            return "-"
        return (
            obj.member.user.get_full_name()
            or obj.member.user.username
            or obj.member.national_id
        )

    def validate_member(self, member):
        if not member.is_active:
            raise serializers.ValidationError("Member is already inactive.")
        if MemberExit.objects.filter(member=member).exists():
            raise serializers.ValidationError("Member already has an exit record.")
        return member

    def create(self, validated_data):

        member = validated_data["member"]
        total_shares = member.total_savings_amount()
        total_profit = member.total_unpaid_profit()
        total_entitlement = total_shares + total_profit
        if total_entitlement <= 0:
            raise serializers.ValidationError(
                "Member has no eligible total (shares + profit) to exit with."
            )

        # Compute exit breakdown
        amount_paid = int(total_entitlement * 0.90)
        retained_amount = total_entitlement - amount_paid

        request = self.context["request"]

        with transaction.atomic():

            # 1. Create Exit Record
            exit_record = MemberExit.objects.create(
                member=member,
                total_savings=total_entitlement,
                amount_paid=amount_paid,
                retained_amount=retained_amount,
                exit_date=timezone.localdate(),
                approved_by=request.user,
                notes=validated_data.get("notes", "")
            )

            # 2. Mark member and current saving subscriptions inactive (BLOCK ACCESS)
            member.is_active = False
            member.save(update_fields=["is_active"])
            member.saving_choices.filter(is_active=True).update(is_active=False)
            if member.user and member.user.is_active:
                member.user.is_active = False
                member.user.save(update_fields=["is_active"])

            # 3. Income Category (Retained 10%)
            retained_income_cat, _ = IncomeCategory.objects.get_or_create(
                name="Retained Member Exit Funds"
            )

            Income.objects.create(
                category=retained_income_cat,
                amount=retained_amount,
                description=(
                    f"Member exit retention (10%) for {member.national_id}. "
                    f"Shares={total_shares}, Profit={total_profit}, Total={total_entitlement}"
                ),
                income_date=exit_record.exit_date,
                related_model="MemberExit",
                related_object_id=exit_record.id,
                recorded_by=request.user
            )

            MemberWithdrawal.objects.create(
                member=member,
                withdrawal_type=MemberWithdrawal.WithdrawalType.EXIT,
                amount=amount_paid,
                withdrawn_on=exit_record.exit_date,
                approved_by=request.user,
                member_exit=exit_record,
                notes=(
                    f"Member exit withdrawal for {member.national_id}. "
                    f"Net paid after 10% retention."
                ),
            )

        return exit_record

