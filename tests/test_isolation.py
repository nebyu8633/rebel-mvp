"""Restaurant data isolation: one restaurant must never see another
restaurant's suppliers, products, invoices, or price history."""
from datetime import date
from decimal import Decimal

from app.db.models import Invoice, InvoiceItem
from app.guard.matching import get_or_create_product, get_or_create_supplier
from app.guard.price_guard import STATUS_FIRST_PRICE, evaluate_price


def test_suppliers_and_products_do_not_leak_across_restaurants(db_session, make_restaurant):
    restaurant_a = make_restaurant(phone="+972500000001", name="A")
    restaurant_b = make_restaurant(phone="+972500000002", name="B")

    supplier_a = get_or_create_supplier(db_session, restaurant_a.id, "בשר הצפון")
    supplier_b = get_or_create_supplier(db_session, restaurant_b.id, "בשר הצפון")
    product_a, _ = get_or_create_product(db_session, restaurant_a.id, "אנטריקוט")
    product_b, _ = get_or_create_product(db_session, restaurant_b.id, "אנטריקוט")

    assert supplier_a.id != supplier_b.id
    assert product_a.id != product_b.id


def test_price_history_never_crosses_restaurants(db_session, make_restaurant, settings):
    """Even with the same supplier name and same product name, restaurant B
    must not see restaurant A's price history - its first purchase must be
    reported as a fresh baseline, never compared against A's prices."""
    restaurant_a = make_restaurant(phone="+972500000001", name="A")
    restaurant_b = make_restaurant(phone="+972500000002", name="B")

    supplier_a = get_or_create_supplier(db_session, restaurant_a.id, "בשר הצפון")
    supplier_b = get_or_create_supplier(db_session, restaurant_b.id, "בשר הצפון")
    product_a, _ = get_or_create_product(db_session, restaurant_a.id, "אנטריקוט")
    product_b, _ = get_or_create_product(db_session, restaurant_b.id, "אנטריקוט")

    invoice_a1 = Invoice(
        restaurant_id=restaurant_a.id,
        supplier_id=supplier_a.id,
        invoice_number="A1",
        invoice_date=date(2026, 6, 1),
        source_type="image",
        status="processed",
    )
    db_session.add(invoice_a1)
    db_session.flush()
    item_a1 = InvoiceItem(
        invoice_id=invoice_a1.id,
        product_id=product_a.id,
        raw_name="אנטריקוט",
        normalized_name="אנטריקוט",
        quantity=10,
        unit="kg",
        unit_price=Decimal("100"),
        total_price=Decimal("1000"),
        confidence=0.95,
    )
    db_session.add(item_a1)
    db_session.flush()

    # Restaurant B's first ever purchase of the "same" product/supplier.
    invoice_b1 = Invoice(
        restaurant_id=restaurant_b.id,
        supplier_id=supplier_b.id,
        invoice_number="B1",
        invoice_date=date(2026, 6, 2),
        source_type="image",
        status="processed",
    )
    db_session.add(invoice_b1)
    db_session.flush()
    item_b1 = InvoiceItem(
        invoice_id=invoice_b1.id,
        product_id=product_b.id,
        raw_name="אנטריקוט",
        normalized_name="אנטריקוט",
        quantity=10,
        unit="kg",
        unit_price=Decimal("500"),  # wildly different price from A's 100
        total_price=Decimal("5000"),
        confidence=0.95,
    )
    db_session.add(item_b1)
    db_session.flush()

    result_b = evaluate_price(
        db_session, item_b1, restaurant_b.id, supplier_b.id, product_b.id, invoice_b1.invoice_date, settings
    )

    assert result_b.status == STATUS_FIRST_PRICE
    assert result_b.num_previous == 0
    assert result_b.alert is None


def test_duplicate_invoice_query_filters_by_restaurant(db_session, make_restaurant):
    from app.db import repository

    restaurant_a = make_restaurant(phone="+972500000001", name="A")
    restaurant_b = make_restaurant(phone="+972500000002", name="B")
    supplier_a = get_or_create_supplier(db_session, restaurant_a.id, "בשר הצפון")

    invoice = Invoice(
        restaurant_id=restaurant_a.id,
        supplier_id=supplier_a.id,
        invoice_number="SAME-NUMBER",
        invoice_date=date(2026, 6, 1),
        source_type="image",
        status="processed",
    )
    db_session.add(invoice)
    db_session.flush()

    # restaurant_b has no supplier with this id at all - simulate an
    # (impossible in practice) cross-restaurant id guess and confirm no leak.
    leaked = repository.find_duplicate_invoice(db_session, restaurant_b.id, supplier_a.id, "SAME-NUMBER")

    assert leaked is None
