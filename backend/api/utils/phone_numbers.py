from django.core.exceptions import ValidationError


DEFAULT_COUNTRY_CODE = "+250"
MAX_LOCAL_PHONE_DIGITS = 9

COUNTRY_CODE_CHOICES = (
    ("+250", "Rwanda (+250)"),
    ("+254", "Kenya (+254)"),
    ("+255", "Tanzania (+255)"),
    ("+256", "Uganda (+256)"),
    ("+257", "Burundi (+257)"),
    ("+243", "DR Congo (+243)"),
    ("+211", "South Sudan (+211)"),
)

PHONE_VALIDATION_MESSAGES = {
    "country_code": "Select a country code.",
    "local_number": "Enter phone digits.",
    "local_digits_only": "Phone digits after the country code must contain digits only.",
    "missing_plus": "Phone number must include country code (example: +2507XXXXXXXX).",
    "digits_only": "Phone number must contain digits after country code.",
    "too_long": "Phone digits after the country code must not exceed 9.",
    "rwanda_length": "Rwanda phone number must have exactly 9 digits after +250.",
    "international_short": "International phone number is too short.",
}


def split_phone_number(value, *, default_country_code=DEFAULT_COUNTRY_CODE, known_codes=None):
    normalized = str(value or "").strip()
    if not normalized:
        return default_country_code, ""

    codes = known_codes or [code for code, _ in COUNTRY_CODE_CHOICES]
    for code in sorted(codes, key=len, reverse=True):
        if normalized.startswith(code):
            local = normalized[len(code):]
            if local.isdigit():
                return code, local

    if normalized.startswith("+") and normalized[1:].isdigit():
        digits = normalized[1:]
        if len(digits) > MAX_LOCAL_PHONE_DIGITS:
            return f"+{digits[:-MAX_LOCAL_PHONE_DIGITS]}", digits[-MAX_LOCAL_PHONE_DIGITS:]
        return f"+{digits}", ""

    return default_country_code, normalized.lstrip("+")


def normalize_phone_number(value, *, required=True):
    normalized = str(value or "").strip()
    if not normalized:
        if required:
            raise ValidationError(PHONE_VALIDATION_MESSAGES["local_number"])
        return ""

    if not normalized.startswith("+"):
        raise ValidationError(PHONE_VALIDATION_MESSAGES["missing_plus"])

    digits = normalized[1:]
    if not digits.isdigit():
        raise ValidationError(PHONE_VALIDATION_MESSAGES["digits_only"])

    if normalized.startswith(DEFAULT_COUNTRY_CODE):
        local = normalized[len(DEFAULT_COUNTRY_CODE):]
        if len(local) != MAX_LOCAL_PHONE_DIGITS:
            raise ValidationError(PHONE_VALIDATION_MESSAGES["rwanda_length"])
    elif len(digits) < MAX_LOCAL_PHONE_DIGITS:
        raise ValidationError(PHONE_VALIDATION_MESSAGES["international_short"])

    return normalized


def compose_phone_number(country_code, local_number, *, required=True):
    code = str(country_code or "").strip()
    local = str(local_number or "").strip()

    if not code and not local:
        if required:
            raise ValidationError(PHONE_VALIDATION_MESSAGES["local_number"])
        return ""
    if not code:
        raise ValidationError(PHONE_VALIDATION_MESSAGES["country_code"])
    if not local:
        raise ValidationError(PHONE_VALIDATION_MESSAGES["local_number"])
    if not local.isdigit():
        raise ValidationError(PHONE_VALIDATION_MESSAGES["local_digits_only"])
    if len(local) > MAX_LOCAL_PHONE_DIGITS:
        raise ValidationError(PHONE_VALIDATION_MESSAGES["too_long"])
    if code == DEFAULT_COUNTRY_CODE and len(local) != MAX_LOCAL_PHONE_DIGITS:
        raise ValidationError(PHONE_VALIDATION_MESSAGES["rwanda_length"])

    return normalize_phone_number(f"{code}{local}", required=required)
