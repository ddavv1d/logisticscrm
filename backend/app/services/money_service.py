"""Деньги: маржа в USD (по amount_usd), долги по остатку (amount − paid_amount).

Council: считать по (amount − paid_amount), НЕ по тексту payment_status.
Мультивалюта суммируется корректно через amount_usd (GENERATED в БД).
"""

from decimal import Decimal

from app.models.models import ChargeLine, Container


def container_money(container: Container) -> dict:
    income = Decimal("0")
    expense = Decimal("0")
    receivable = Decimal("0")  # остаток к получению (income с непогашенным остатком), USD
    for c in container.charges:
        usd = Decimal(str(c.amount_usd or 0))
        if c.kind == "income":
            income += usd
            outstanding = Decimal(str(c.amount)) - Decimal(str(c.paid_amount))
            if outstanding > 0:
                # к получению в USD-эквиваленте
                receivable += outstanding * Decimal(str(c.rate_to_usd))
        else:
            expense += usd
    margin = income - expense
    return {
        "income_usd": float(income),
        "expense_usd": float(expense),
        "margin_usd": float(margin),
        "receivable_usd": float(receivable),
    }


def charge_outstanding(charge: ChargeLine) -> Decimal:
    return Decimal(str(charge.amount)) - Decimal(str(charge.paid_amount))
