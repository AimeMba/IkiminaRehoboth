from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from .models import Income, IncomeCategory, MembershipFee


@receiver(post_save, sender=MembershipFee)
def membership_fee_post_save(sender, instance, created, **kwargs):
    if not created:
        return

    # Ensure paid_on is always set, even when created outside API serializer.
    if not instance.paid_on:
        instance.paid_on = timezone.localdate()
        instance.save(update_fields=["paid_on"])

    category, _ = IncomeCategory.objects.get_or_create(name="Membership Fee")
    Income.objects.get_or_create(
        related_model="MembershipFee",
        related_object_id=instance.id,
        defaults={
            "category": category,
            "amount": instance.amount,
            "description": f"Membership fee paid by {instance.member}",
            "income_date": instance.paid_on or timezone.localdate(),
            "recorded_by": instance.received_by,
        },
    )

    # Grant access immediately after membership fee payment.
    member_user = getattr(instance.member, "user", None)
    if member_user and not member_user.is_active:
        member_user.is_active = True
        member_user.save(update_fields=["is_active"])
