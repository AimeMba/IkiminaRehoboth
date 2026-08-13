from django.core.mail import send_mail
from django.utils import timezone
from django.db.models import Sum

from api.models import MemberSavingChoice, MonthlySaving, Notification, Loan
from api.services.sms_service import send_sms


def _previous_month_year(reference_date):
    if reference_date.month == 1:
        return 12, reference_date.year - 1
    return reference_date.month - 1, reference_date.year


def send_monthly_saving_reminders(force=False):
    """
    Send monthly saving reminders on the 4th day of month.
    - In-app notification is always created (once per user/month).
    - Email is attempted when user has email.
    - SMS hook is prepared for future integration.
    """
    today = timezone.localdate()
    if today.day != 4 and not force:
        return {
            "status": "skipped",
            "reason": "today is not the 4th day of month",
            "created_notifications": 0,
            "email_sent": 0,
            "sms_sent": 0,
        }

    target_month, target_year = _previous_month_year(today)

    choices = (
        MemberSavingChoice.objects.select_related("member__user", "category")
        .filter(
            is_active=True,
            category__year=target_year,
            member__is_active=True,
            member__user__is_active=True,
        )
    )

    created_notifications = 0
    email_sent = 0
    sms_sent = 0

    for choice in choices:
        paid = MonthlySaving.objects.filter(
            saving_choice=choice,
            month=target_month,
            year=target_year,
        ).exists()
        if paid:
            continue

        member = choice.member
        user = member.user
        amount = int(choice.category.monthly_amount)
        full_name = user.get_full_name() or user.username

        title = "Saving Reminder"
        message = (
            f"Muraho {full_name}, mwibutswa kwishyura ubwizigame bw'ukwezi kwa {target_month}/{target_year} mbere ya 5. "
            f"Icyiciro mwahisemo ni {choice.category.name} ({amount} RWF). "
            "Nyuma ya 5, mutangira kubarirwa amande ya 10%."
        )

        notification, created = Notification.objects.get_or_create(
            user=user,
            notification_type=Notification.NotificationType.SAVING_REMINDER,
            year=target_year,
            month=target_month,
            defaults={
                "title": title,
                "message": message,
            },
        )

        if not created:
            continue

        created_notifications += 1

        if user.email:
            sent_count = send_mail(
                subject=title,
                message=message,
                from_email=None,
                recipient_list=[user.email],
                fail_silently=True,
            )
            if sent_count:
                notification.sent_email = True
                email_sent += 1

        if member.phone:
            sms_ok = send_sms(member.phone, message)
            if sms_ok:
                notification.sent_sms = True
                sms_sent += 1

        if notification.sent_email or notification.sent_sms:
            notification.save(update_fields=["sent_email", "sent_sms"])

    return {
        "status": "done",
        "created_notifications": created_notifications,
        "email_sent": email_sent,
        "sms_sent": sms_sent,
    }


def send_loan_payment_reminders(force=False):
    """
    Send loan payment reminders on the 4th day of month.
    - In-app notification is created once per user/month.
    - Email is attempted if user email exists.
    - SMS hook is prepared for future integration.
    """
    today = timezone.localdate()
    if today.day != 4 and not force:
        return {
            "status": "skipped",
            "reason": "today is not the 4th day of month",
            "created_notifications": 0,
            "email_sent": 0,
            "sms_sent": 0,
        }

    loans = Loan.objects.select_related(
        "member__user",
        "client__user",
    ).exclude(status="PAID")

    per_user = {}
    for loan in loans:
        principal_paid = loan.repayments.aggregate(total=Sum("principal_amount"))["total"] or 0
        remaining_principal = int(loan.principal_amount) - int(principal_paid)
        if remaining_principal <= 0:
            continue

        owner_user = None
        owner_phone = None
        owner_name = "-"
        if loan.member and loan.member.user:
            owner_user = loan.member.user
            owner_phone = loan.member.phone
            owner_name = owner_user.get_full_name() or owner_user.username or loan.member.national_id
        elif loan.client and loan.client.user:
            owner_user = loan.client.user
            owner_phone = loan.client.phone
            owner_name = loan.client.full_name

        if not owner_user or not owner_user.is_active:
            continue

        bucket = per_user.setdefault(
            owner_user.id,
            {
                "user": owner_user,
                "phone": owner_phone,
                "name": owner_name,
                "loan_count": 0,
                "remaining_total": 0,
                "loan_ids": [],
            },
        )
        bucket["loan_count"] += 1
        bucket["remaining_total"] += remaining_principal
        bucket["loan_ids"].append(loan.id)

    created_notifications = 0
    email_sent = 0
    sms_sent = 0

    for payload in per_user.values():
        user = payload["user"]
        title = "Loan Repayment Reminder"
        message = (
            f"Muraho {payload['name']}, mwibutswa kwishyura inguzanyo zanyu zisigaye. "
            f"Mufite inguzanyo {payload['loan_count']} zitararangira, "
            f"asigaye kwishyurwa hamwe ni {int(payload['remaining_total'])} RWF "
            f"(Loan IDs: {', '.join(str(loan_id) for loan_id in payload['loan_ids'])})."
        )

        notification, created = Notification.objects.get_or_create(
            user=user,
            notification_type=Notification.NotificationType.LOAN_REMINDER,
            year=today.year,
            month=today.month,
            defaults={
                "title": title,
                "message": message,
            },
        )

        if not created:
            continue

        created_notifications += 1

        if user.email:
            sent_count = send_mail(
                subject=title,
                message=message,
                from_email=None,
                recipient_list=[user.email],
                fail_silently=True,
            )
            if sent_count:
                notification.sent_email = True
                email_sent += 1

        if payload["phone"]:
            sms_ok = send_sms(payload["phone"], message)
            if sms_ok:
                notification.sent_sms = True
                sms_sent += 1

        if notification.sent_email or notification.sent_sms:
            notification.save(update_fields=["sent_email", "sent_sms"])

    return {
        "status": "done",
        "created_notifications": created_notifications,
        "email_sent": email_sent,
        "sms_sent": sms_sent,
    }

