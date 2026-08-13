from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Sum

from ..models import MemberAnnualProfit

RATE_PRECISION = Decimal("0.0001")


def calculate_rate_percent(numerator, denominator):
    numerator = int(numerator or 0)
    denominator = int(denominator or 0)
    if denominator <= 0:
        return Decimal("0.0000")
    return (
        (Decimal(str(numerator)) / Decimal(str(denominator))) * Decimal("100")
    ).quantize(RATE_PRECISION, rounding=ROUND_HALF_UP)


def get_total_adjusted_capital_for_year(year):
    return int(
        MemberAnnualProfit.objects.filter(closing__year=year).aggregate(total=Sum("total_amount"))[
            "total"
        ]
        or 0
    )


def get_closing_profit_rate_percent(closing):
    if not closing:
        return Decimal("0.0000")
    stored_rate = getattr(closing, "profit_rate_percent", None)
    if stored_rate not in {None, ""}:
        return Decimal(str(stored_rate)).quantize(RATE_PRECISION, rounding=ROUND_HALF_UP)
    return calculate_rate_percent(
        getattr(closing, "net_profit", 0),
        get_total_adjusted_capital_for_year(getattr(closing, "year", None)),
    )


def get_closing_total_adjusted_capital(closing):
    if not closing:
        return 0
    stored_total = getattr(closing, "total_adjusted_capital", None)
    if stored_total not in {None, ""}:
        return int(stored_total or 0)
    return get_total_adjusted_capital_for_year(getattr(closing, "year", None))


def get_member_profit_rate_percent(annual_profit):
    if not annual_profit:
        return Decimal("0.0000")
    return calculate_rate_percent(
        getattr(annual_profit, "profit", 0),
        getattr(annual_profit, "total_amount", 0),
    )
