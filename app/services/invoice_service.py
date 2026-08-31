"""Orchestrates the end-to-end invoice pipeline:

extract -> validate -> match supplier/product -> duplicate check -> save ->
run Price Guard -> build a WhatsApp-ready summary message.

This is the single place that ties AI extraction, matching and price
guarding together, so both the WhatsApp webhook and tests/CLI tooling can
call one function and get a consistent result.
"""
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.ai.extractor import ExtractionError, extract_invoice
from app.config import Settings, get_settings
from app.db import repository
from app.db.models import Invoice, Restaurant
from app.guard.matching import get_or_create_product, get_or_create_supplier, normalize_name, normalize_unit
from app.guard.price_guard import (
    STATUS_ALERT,
    STATUS_FIRST_PRICE,
    PriceEvaluation,
    evaluate_price,
)

STATUS_DUPLICATE = "duplicate"
STATUS_EXTRACTION_FAILED = "extraction_failed"
STATUS_PROCESSED = "processed"
STATUS_NEEDS_REVIEW = "needs_review"


@dataclass
class ItemOutcome:
    product_name: str
    unit: str | None
    display_unit: str | None
    evaluation: PriceEvaluation
    is_new_product: bool


@dataclass
class ProcessingResult:
    status: str
    message: str
    invoice: Invoice | None = None
    item_outcomes: list[ItemOutcome] = field(default_factory=list)


def _fmt_money(value: Decimal) -> str:
    return f"{value:,.2f}"


def _fmt_pct(value: Decimal) -> str:
    return f"{value * 100:.1f}%"


def _build_message(
    status: str,
    supplier_name: str | None,
    invoice_number: str | None,
    total: Decimal | None,
    item_outcomes: list[ItemOutcome],
) -> str:
    if status == STATUS_DUPLICATE:
        return "⚠️ החשבונית הזו כבר נקלטה במערכת."

    if status == STATUS_EXTRACTION_FAILED:
        return "⚠️ לא הצלחתי לקרוא את החשבונית בצורה אמינה.\n\nנסה לשלוח תמונה ברורה יותר או PDF."

    if status == STATUS_NEEDS_REVIEW:
        return (
            "⚠️ החשבונית נקלטה, אך חסרים בה נתונים קריטיים (מחירים או סכום כולל).\n\n"
            "אנא בדוק ידנית מול הספק."
        )

    alerts = [o for o in item_outcomes if o.evaluation.status == STATUS_ALERT]
    first_price_items = [o for o in item_outcomes if o.evaluation.status == STATUS_FIRST_PRICE]

    if alerts:
        return _render_alert_message(supplier_name, alerts)

    if invoice_number is not None or total is not None:
        header = "✅ החשבונית נקלטה בהצלחה."
    else:
        header = "✅ החשבונית נקלטה."

    lines = [header, ""]
    if supplier_name:
        lines.append(f"ספק: {supplier_name}")
    if invoice_number:
        lines.append(f"חשבונית: {invoice_number}")
    if total is not None:
        lines.append(f"סה״כ: ₪{_fmt_money(total)}")
    lines.append("")

    if first_price_items and len(first_price_items) == len(item_outcomes):
        lines.append(f"נרשם מחיר בסיס ראשון עבור {len(first_price_items)} פריטים.")
        lines.append("עדיין אין מספיק היסטוריה כדי לזהות שינויי מחיר.")
    elif first_price_items:
        lines.append(f"נרשם מחיר בסיס ראשון עבור {len(first_price_items)} פריטים חדשים.")
        lines.append("לא נמצאו חריגות מחיר ביחס להיסטוריית הרכישות עבור שאר הפריטים.")
    else:
        lines.append("לא נמצאו חריגות מחיר ביחס להיסטוריית הרכישות.")

    return "\n".join(lines)


def _render_alert_message(supplier_name: str | None, alerts: list[ItemOutcome]) -> str:
    lines = ["⚠️ נמצאה חריגת מחיר", ""]
    if supplier_name:
        lines.append(f"ספק: {supplier_name}")
        lines.append("")

    for outcome in alerts:
        ev = outcome.evaluation
        unit_label = f" ל{outcome.display_unit}" if outcome.display_unit else ""
        basis_note = (
            "\n(בהשוואה לחשבונית הקודמת)" if ev.historical_avg is None and ev.num_previous == 1 else ""
        )
        lines.append(f"מוצר:\n{outcome.product_name}")
        lines.append("")
        lines.append(f"מחיר קודם:\n₪{_fmt_money(ev.previous_price)}{unit_label}{basis_note}")
        lines.append("")
        lines.append(f"מחיר נוכחי:\n₪{_fmt_money(ev.current_price)}{unit_label}")
        lines.append("")
        lines.append(f"עלייה:\n{_fmt_pct(ev.percentage_change)}")
        lines.append("")
        if ev.estimated_impact is not None:
            lines.append(f"עלות נוספת משוערת:\n₪{_fmt_money(ev.estimated_impact)}")
            lines.append("")

    lines.append("בדוק מול הספק.")
    return "\n".join(lines)


def process_invoice(
    db: Session,
    restaurant: Restaurant,
    file_bytes: bytes,
    mime_type: str,
    source_type: str,
    source_url: str | None = None,
    settings: Settings | None = None,
) -> ProcessingResult:
    settings = settings or get_settings()

    try:
        extraction = extract_invoice(file_bytes, mime_type, settings=settings)
    except ExtractionError:
        message = _build_message(STATUS_EXTRACTION_FAILED, None, None, None, [])
        return ProcessingResult(status=STATUS_EXTRACTION_FAILED, message=message)

    supplier = get_or_create_supplier(db, restaurant.id, extraction.supplier.raw_name)

    duplicate = repository.find_duplicate_invoice(
        db, restaurant.id, supplier.id, extraction.invoice.number
    )
    if duplicate:
        message = _build_message(STATUS_DUPLICATE, supplier.name, extraction.invoice.number, None, [])
        return ProcessingResult(status=STATUS_DUPLICATE, message=message, invoice=duplicate)

    has_any_price_data = any(
        i.total_price is not None or i.unit_price is not None for i in extraction.items
    )
    invoice_status = STATUS_PROCESSED if (has_any_price_data or extraction.invoice.total is not None) else STATUS_NEEDS_REVIEW

    avg_confidence = sum(i.confidence for i in extraction.items) / len(extraction.items)

    invoice = repository.create_invoice(
        db,
        restaurant_id=restaurant.id,
        supplier_id=supplier.id,
        invoice_number=extraction.invoice.number,
        invoice_date=extraction.invoice.date,
        subtotal=extraction.invoice.subtotal,
        tax=extraction.invoice.tax,
        total=extraction.invoice.total,
        source_type=source_type,
        source_url=source_url,
        extraction_confidence=avg_confidence,
        status=invoice_status,
    )

    invoice_date = extraction.invoice.date or date.today()
    item_outcomes: list[ItemOutcome] = []

    for item_extract in extraction.items:
        normalized_item_name = normalize_name(item_extract.raw_name)
        unit = normalize_unit(item_extract.unit)

        product, is_new_product = get_or_create_product(
            db, restaurant.id, item_extract.raw_name, default_unit=unit
        )

        invoice_item = repository.create_invoice_item(
            db,
            invoice_id=invoice.id,
            product_id=product.id,
            raw_name=item_extract.raw_name,
            normalized_name=normalized_item_name,
            quantity=item_extract.quantity,
            unit=unit,
            unit_price=item_extract.unit_price,
            total_price=item_extract.total_price,
            confidence=item_extract.confidence,
        )

        evaluation = evaluate_price(
            db,
            invoice_item=invoice_item,
            restaurant_id=restaurant.id,
            supplier_id=supplier.id,
            product_id=product.id,
            invoice_date=invoice_date,
            settings=settings,
        )

        item_outcomes.append(
            ItemOutcome(
                product_name=product.canonical_name,
                unit=unit,
                display_unit=item_extract.unit or unit,
                evaluation=evaluation,
                is_new_product=is_new_product,
            )
        )

    db.commit()
    db.refresh(invoice)

    message = _build_message(
        invoice_status,
        supplier.name,
        extraction.invoice.number,
        Decimal(str(extraction.invoice.total)) if extraction.invoice.total is not None else None,
        item_outcomes,
    )

    return ProcessingResult(status=invoice_status, message=message, invoice=invoice, item_outcomes=item_outcomes)
