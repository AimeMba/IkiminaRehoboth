from django.conf import settings


def send_sms(phone_number, message):
    """
    Placeholder SMS sender for future integration.
    Returns True only when a real provider integration is enabled.
    """
    if not getattr(settings, "SMS_ENABLED", False):
        return False

    # Future integration point for providers (Twilio, Africa's Talking, etc.)
    # Keep False for now to avoid fake delivery status.
    _ = phone_number
    _ = message
    return False

