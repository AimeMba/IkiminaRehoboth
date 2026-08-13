import hashlib
import hmac

from django.conf import settings

BIOMETRIC_HASH_PREFIX = "sha256$"


def normalize_biometric_template(template):
    return str(template or "").strip()


def is_hashed_biometric_template(template):
    return normalize_biometric_template(template).startswith(BIOMETRIC_HASH_PREFIX)


def hash_biometric_template(template):
    normalized = normalize_biometric_template(template)
    if not normalized:
        return ""
    digest = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        normalized.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{BIOMETRIC_HASH_PREFIX}{digest}"


def verify_biometric_template(stored_template, submitted_template):
    stored = normalize_biometric_template(stored_template)
    submitted = normalize_biometric_template(submitted_template)
    if not stored or not submitted:
        return False, ""

    hashed_submitted = hash_biometric_template(submitted)
    if is_hashed_biometric_template(stored):
        return hmac.compare_digest(stored, hashed_submitted), hashed_submitted

    # Backward compatibility for older raw templates. The caller can re-save the
    # returned hashed value to migrate the record after a successful match.
    if hmac.compare_digest(stored, submitted):
        return True, hashed_submitted

    return False, hashed_submitted
