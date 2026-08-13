from .models import TransactionLog

def log_transaction(
    *,
    user,
    transaction_type,
    action,
    related_model,
    related_object_id=None,
    amount=None,
    description="",
    ip_address=None,
):
    TransactionLog.objects.create(
        user=user,
        transaction_type=transaction_type,
        action=action,
        related_model=related_model,
        related_object_id=related_object_id,
        amount=amount,
        description=description,
        ip_address=ip_address,
    )

