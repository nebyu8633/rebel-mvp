from datetime import date, timedelta
from decimal import Decimal

from app.db.models import Invoice, InvoiceItem
from app.guard.matching import get_or_create_product, get_or_create_supplier
from app.guard.price_guard import (
    STATUS_ALERT,
    STATUS_COMPARED_AVERAGE,
    STATUS_COMPARED_PREVIOUS,
    STATUS_FIRST_PRICE,
    SEVERITY_CRITICAL,
    SEVERITY_WARNING,
    evaluate_price,
)


def _make_invoice(db, restaurant_id, supplier_id, number, invoice_date):
    invoice = Invoice(
        restaurant_id=restaurant_id,
        supplier_id=supplier_id,
        invoice_number=number,
        invoice_date=invoice_date,
        source_type="image",
        status="processed",
    )
    db.add(invoice)
    db.flush()
    return invoice


def _make_item(db, invoice_id, product_id, unit_price, quantity=10, confidence=0.95, raw_name="אנטריקוט"):
    item = InvoiceItem(
        invoice_id=invoice_id,
        product_id=product_id,
        raw_name=raw_name,
        normalized_name=raw_name,
        quantity=quantity,
        unit="kg",
        unit_price=unit_price,
        total_price=(unit_price * quantity) if unit_price is not None else None,
        confidence=confidence,
    )
    db.add(item)
    db.flush()
    return item


def _setup_supplier_product(db, restaurant):
    supplier = get_or_create_supplier(db, restaurant.id, "בשר הצפון")
    product, _ = get_or_create_product(db, restaurant.id, "אנטריקוט טרי מיוחד")
    return supplier, product


def test_no_history_returns_first_price(db_session, make_restaurant, settings):
    restaurant = make_restaurant()
    supplier, product = _setup_supplier_product(db_session, restaurant)

    invoice = _make_invoice(db_session, restaurant.id, supplier.id, "1", date(2026, 6, 1))
    item = _make_item(db_session, invoice.id, product.id, unit_price=109)

    result = evaluate_price(
        db_session, item, restaurant.id, supplier.id, product.id, invoice.invoice_date, settings
    )

    assert result.status == STATUS_FIRST_PRICE
    assert result.num_previous == 0
    assert result.alert is None


def test_one_previous_price_is_compared_directly(db_session, make_restaurant, settings):
    restaurant = make_restaurant()
    supplier, product = _setup_supplier_product(db_session, restaurant)

    inv1 = _make_invoice(db_session, restaurant.id, supplier.id, "1", date(2026, 6, 1))
    _make_item(db_session, inv1.id, product.id, unit_price=100)

    inv2 = _make_invoice(db_session, restaurant.id, supplier.id, "2", date(2026, 6, 5))
    item2 = _make_item(db_session, inv2.id, product.id, unit_price=101)

    result = evaluate_price(
        db_session, item2, restaurant.id, supplier.id, product.id, inv2.invoice_date, settings
    )

    assert result.status == STATUS_COMPARED_PREVIOUS
    assert result.num_previous == 1
    assert result.previous_price == Decimal("100")
    assert result.historical_avg is None


def test_multiple_previous_prices_use_average(db_session, make_restaurant, settings):
    restaurant = make_restaurant()
    supplier, product = _setup_supplier_product(db_session, restaurant)

    for i, price in enumerate([100, 102, 98]):
        inv = _make_invoice(db_session, restaurant.id, supplier.id, str(i), date(2026, 6, 1 + i))
        _make_item(db_session, inv.id, product.id, unit_price=price)

    inv_new = _make_invoice(db_session, restaurant.id, supplier.id, "new", date(2026, 6, 10))
    item_new = _make_item(db_session, inv_new.id, product.id, unit_price=100)

    result = evaluate_price(
        db_session, item_new, restaurant.id, supplier.id, product.id, inv_new.invoice_date, settings
    )

    assert result.status == STATUS_COMPARED_AVERAGE
    assert result.num_previous == 3
    assert result.historical_avg == Decimal("100")


def test_price_increase_above_threshold_creates_alert(db_session, make_restaurant, settings):
    """Matches the worked example from the product spec: 109 -> 120 for a
    quantity of 10 must produce a critical alert with impact of 110."""
    restaurant = make_restaurant()
    supplier, product = _setup_supplier_product(db_session, restaurant)

    inv1 = _make_invoice(db_session, restaurant.id, supplier.id, "1", date(2026, 6, 1))
    _make_item(db_session, inv1.id, product.id, unit_price=109, quantity=10)

    inv2 = _make_invoice(db_session, restaurant.id, supplier.id, "2", date(2026, 6, 15))
    item2 = _make_item(db_session, inv2.id, product.id, unit_price=120, quantity=10)

    result = evaluate_price(
        db_session, item2, restaurant.id, supplier.id, product.id, inv2.invoice_date, settings
    )

    assert result.status == STATUS_ALERT
    assert result.severity == SEVERITY_CRITICAL
    assert result.estimated_impact == Decimal("110.00")
    assert result.percentage_change > Decimal("0.10")
    assert result.alert is not None
    assert result.alert.severity == SEVERITY_CRITICAL


def test_price_increase_below_threshold_no_alert(db_session, make_restaurant, settings):
    restaurant = make_restaurant()
    supplier, product = _setup_supplier_product(db_session, restaurant)

    inv1 = _make_invoice(db_session, restaurant.id, supplier.id, "1", date(2026, 6, 1))
    _make_item(db_session, inv1.id, product.id, unit_price=100, quantity=10)

    # 1.5% increase - below the 3% default threshold.
    inv2 = _make_invoice(db_session, restaurant.id, supplier.id, "2", date(2026, 6, 15))
    item2 = _make_item(db_session, inv2.id, product.id, unit_price=101.5, quantity=10)

    result = evaluate_price(
        db_session, item2, restaurant.id, supplier.id, product.id, inv2.invoice_date, settings
    )

    assert result.status == STATUS_COMPARED_PREVIOUS
    assert result.alert is None
    assert result.severity is None


def test_warning_severity_between_threshold_and_critical(db_session, make_restaurant, settings):
    restaurant = make_restaurant()
    supplier, product = _setup_supplier_product(db_session, restaurant)

    inv1 = _make_invoice(db_session, restaurant.id, supplier.id, "1", date(2026, 6, 1))
    _make_item(db_session, inv1.id, product.id, unit_price=100, quantity=10)

    # 5% increase - above 3% threshold, below 10% critical.
    inv2 = _make_invoice(db_session, restaurant.id, supplier.id, "2", date(2026, 6, 15))
    item2 = _make_item(db_session, inv2.id, product.id, unit_price=105, quantity=10)

    result = evaluate_price(
        db_session, item2, restaurant.id, supplier.id, product.id, inv2.invoice_date, settings
    )

    assert result.status == STATUS_ALERT
    assert result.severity == SEVERITY_WARNING
    assert result.estimated_impact == Decimal("50.00")


def test_estimated_impact_calculation_is_deterministic(db_session, make_restaurant, settings):
    restaurant = make_restaurant()
    supplier, product = _setup_supplier_product(db_session, restaurant)

    inv1 = _make_invoice(db_session, restaurant.id, supplier.id, "1", date(2026, 6, 1))
    _make_item(db_session, inv1.id, product.id, unit_price=Decimal("50.00"), quantity=Decimal("7.5"))

    inv2 = _make_invoice(db_session, restaurant.id, supplier.id, "2", date(2026, 6, 15))
    item2 = _make_item(db_session, inv2.id, product.id, unit_price=Decimal("60.00"), quantity=Decimal("7.5"))

    result = evaluate_price(
        db_session, item2, restaurant.id, supplier.id, product.id, inv2.invoice_date, settings
    )

    # (60 - 50) * 7.5 = 75.00
    assert result.estimated_impact == Decimal("75.00")


def test_low_confidence_item_never_creates_automatic_alert(db_session, make_restaurant, settings):
    restaurant = make_restaurant()
    supplier, product = _setup_supplier_product(db_session, restaurant)

    inv1 = _make_invoice(db_session, restaurant.id, supplier.id, "1", date(2026, 6, 1))
    _make_item(db_session, inv1.id, product.id, unit_price=100, quantity=10, confidence=0.95)

    # Huge increase, but confidence is below MIN_CONFIDENCE.
    inv2 = _make_invoice(db_session, restaurant.id, supplier.id, "2", date(2026, 6, 15))
    item2 = _make_item(db_session, inv2.id, product.id, unit_price=200, quantity=10, confidence=0.4)

    result = evaluate_price(
        db_session, item2, restaurant.id, supplier.id, product.id, inv2.invoice_date, settings
    )

    assert result.alert is None
    assert result.skipped_low_confidence is True


def test_history_outside_window_is_ignored(db_session, make_restaurant, settings):
    restaurant = make_restaurant()
    supplier, product = _setup_supplier_product(db_session, restaurant)

    old_date = date(2026, 1, 1)  # far outside the 60-day window
    inv1 = _make_invoice(db_session, restaurant.id, supplier.id, "1", old_date)
    _make_item(db_session, inv1.id, product.id, unit_price=50, quantity=10)

    inv2 = _make_invoice(db_session, restaurant.id, supplier.id, "2", date(2026, 6, 15))
    item2 = _make_item(db_session, inv2.id, product.id, unit_price=120, quantity=10)

    result = evaluate_price(
        db_session, item2, restaurant.id, supplier.id, product.id, inv2.invoice_date, settings
    )

    assert result.status == STATUS_FIRST_PRICE
    assert result.num_previous == 0
