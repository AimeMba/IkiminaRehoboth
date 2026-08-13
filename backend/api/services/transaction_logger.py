from django.utils import timezone

from api.models import TransactionLog


def get_client_ip(request):
    if not request:
        return None
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def log_transaction(
    *,
    user,
    transaction_type,
    action,
    related_model,
    related_object_id=None,
    amount=None,
    description="",
    request=None,
):
    """
    Centralized transaction logging.
    This should never block the main business flow.
    """
    try:
        TransactionLog.objects.create(
            user=user,
            transaction_type=transaction_type,
            action=action,
            related_model=related_model,
            related_object_id=related_object_id,
            amount=amount,
            description=description,
            ip_address=get_client_ip(request),
            timestamp=timezone.now(),
        )
    except Exception:
        # Do not raise logging errors to API consumers.
        pass

