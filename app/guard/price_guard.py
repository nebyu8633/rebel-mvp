"""Price Guard - the deterministic core of Invoice Guard.

The LLM only extracts data. Every financial decision here - matching a
price history, computing a percentage change, computing estimated impact,
deciding severity - is plain, deterministic, testable Python using
Decimal arithmetic. The LLM never decides whether something is a price
anomaly.
"""
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.config import Settings
from app.db.models import Invoice, InvoiceItem, PriceAlert

# Alert severities
SEVERITY_WARNING = "warning"
SEVERITY_CRITICAL = "critical"

# Evaluation statuses
STATUS_NO_PRICE = "no_price"
STATUS_FIRST_PRICE = "first_price"
STATUS_COMPARED_PREVIOUS = "compared_previous"
STATUS_COMPARED_AVERAGE = "compared_average"
STATUS_ALERT = "alert"


def to_decimal(value) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


@dataclass
class PriceEvaluation:
    status: str
    num_previous: int
    current_price: Decimal | None
    previous_price: Decimal | None
    historical_avg: Decimal | None
    reference_price: Decimal | None
    percentage_change: Decimal | None
    estimated_impact: Decimal | None
    severity: str | None
    alert: PriceAlert | None
    skipped_low_confidence: bool = False


def get_price_history(
    db: Session,
    restaurant_id: int,
    supplier_id: int,
    product_id: int,
    reference_date: date,
    window_days: int,
    exclude_invoice_item_id: int | None = None,
) -> list[InvoiceItem]:
    """Prior purchases of the same product, from the same supplier, for the
    same restaurant, within the trailing window - most recent first.

    Restaurant/supplier/product are all filtered explicitly, so history can
    never bleed across restaurants.
    """
    cutoff = reference_date - timedelta(days=window_days)
    query = (
        db.query(InvoiceItem)
        .join(Invoice, InvoiceItem.invoice_id == Invoice.id)
        .filter(
            Invoice.restaurant_id == restaurant_id,
            Invoice.supplier_id == supplier_id,
            InvoiceItem.product_id == product_id,
            InvoiceItem.unit_price.isnot(None),
        )
    )
    if exclude_invoice_item_id is not None:
        query = query.filter(InvoiceItem.id != exclude_invoice_item_id)

    items = query.order_by(Invoice.invoice_date.desc(), InvoiceItem.created_at.desc()).all()

    def purchase_date(item: InvoiceItem) -> date:
        return item.invoice.invoice_date or item.invoice.created_at.date()

    return [item for item in items if purchase_date(item) >= cutoff]


def evaluate_price(
    db: Session,
    invoice_item: InvoiceItem,
    restaurant_id: int,
    supplier_id: int,
    product_id: int,
    invoice_date: date,
    settings: Settings,
) -> PriceEvaluation:
    """Compare invoice_item's price against history and create a PriceAlert
    when the increase exceeds the configured threshold.

    Requires invoice_item.id to already be set (flushed) so it can be
    excluded from its own history lookup and referenced by the alert.
    """
    empty = dict(
        previous_price=None,
        historical_avg=None,
        reference_price=None,
        percentage_change=None,
        estimated_impact=None,
        severity=None,
        alert=None,
    )

    if invoice_item.unit_price is None:
        return PriceEvaluation(status=STATUS_NO_PRICE, num_previous=0, current_price=None, **empty)

    current_price = to_decimal(invoice_item.unit_price)

    history = get_price_history(
        db,
        restaurant_id=restaurant_id,
        supplier_id=supplier_id,
        product_id=product_id,
        reference_date=invoice_date,
        window_days=settings.price_history_window_days,
        exclude_invoice_item_id=invoice_item.id,
    )
    num_previous = len(history)

    if num_previous == 0:
        return PriceEvaluation(status=STATUS_FIRST_PRICE, num_previous=0, current_price=current_price, **empty)

    previous_price = to_decimal(history[0].unit_price)

    if num_previous == 1:
        reference_price = previous_price
        historical_avg = None
        basis_status = STATUS_COMPARED_PREVIOUS
    else:
        total = sum((to_decimal(h.unit_price) for h in history), Decimal(0))
        historical_avg = total / Decimal(len(history))
        reference_price = historical_avg
        basis_status = STATUS_COMPARED_AVERAGE

    # Low-confidence extractions never drive an automatic price alert.
    if to_decimal(invoice_item.confidence) < to_decimal(settings.min_confidence):
        return PriceEvaluation(
            status=basis_status,
            num_previous=num_previous,
            current_price=current_price,
            previous_price=previous_price,
            historical_avg=historical_avg,
            reference_price=reference_price,
            percentage_change=None,
            estimated_impact=None,
            severity=None,
            alert=None,
            skipped_low_confidence=True,
        )

    if reference_price == 0:
        percentage_change = Decimal(0)
    else:
        percentage_change = (current_price - reference_price) / reference_price

    estimated_impact = None
    if invoice_item.quantity is not None:
        quantity = to_decimal(invoice_item.quantity)
        estimated_impact = ((current_price - reference_price) * quantity).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

    threshold = to_decimal(settings.price_alert_threshold)
    critical_threshold = to_decimal(settings.price_alert_critical_threshold)

    if percentage_change <= threshold:
        return PriceEvaluation(
            status=basis_status,
            num_previous=num_previous,
            current_price=current_price,
            previous_price=previous_price,
            historical_avg=historical_avg,
            reference_price=reference_price,
            percentage_change=percentage_change,
            estimated_impact=estimated_impact,
            severity=None,
            alert=None,
        )

    severity = SEVERITY_CRITICAL if percentage_change > critical_threshold else SEVERITY_WARNING

    alert = PriceAlert(
        invoice_item_id=invoice_item.id,
        previous_price=reference_price,
        current_price=current_price,
        percentage_change=percentage_change,
        estimated_impact=estimated_impact if estimated_impact is not None else Decimal("0.00"),
        severity=severity,
    )
    db.add(alert)
    db.flush()

    return PriceEvaluation(
        status=STATUS_ALERT,
        num_previous=num_previous,
        current_price=current_price,
        previous_price=previous_price,
        historical_avg=historical_avg,
        reference_price=reference_price,
        percentage_change=percentage_change,
        estimated_impact=estimated_impact,
        severity=severity,
        alert=alert,
    )
