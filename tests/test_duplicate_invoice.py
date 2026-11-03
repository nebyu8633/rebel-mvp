from datetime import date

from app.db import repository
from app.db.models import Invoice
from app.guard.matching import get_or_create_supplier


def test_duplicate_detected_by_restaurant_supplier_invoice_number(db_session, make_restaurant):
    restaurant = make_restaurant()
    supplier = get_or_create_supplier(db_session, restaurant.id, "בשר הצפון")

    invoice = Invoice(
        restaurant_id=restaurant.id,
        supplier_id=supplier.id,
        invoice_number="10492",
        invoice_date=date(2026, 6, 1),
        source_type="image",
        status="processed",
    )
    db_session.add(invoice)
    db_session.flush()

    duplicate = repository.find_duplicate_invoice(db_session, restaurant.id, supplier.id, "10492")
    not_duplicate = repository.find_duplicate_invoice(db_session, restaurant.id, supplier.id, "99999")

    assert duplicate is not None
    assert duplicate.id == invoice.id
    assert not_duplicate is None


def test_invoice_without_number_is_never_flagged_duplicate(db_session, make_restaurant):
    restaurant = make_restaurant()
    supplier = get_or_create_supplier(db_session, restaurant.id, "בשר הצפון")

    invoice = Invoice(
        restaurant_id=restaurant.id,
        supplier_id=supplier.id,
        invoice_number=None,
        invoice_date=date(2026, 6, 1),
        source_type="image",
        status="processed",
    )
    db_session.add(invoice)
    db_session.flush()

    result = repository.find_duplicate_invoice(db_session, restaurant.id, supplier.id, None)

    assert result is None


def test_duplicate_check_is_scoped_per_restaurant(db_session, make_restaurant):
    restaurant_a = make_restaurant(phone="+972500000001", name="A")
    restaurant_b = make_restaurant(phone="+972500000002", name="B")
    supplier_a = get_or_create_supplier(db_session, restaurant_a.id, "בשר הצפון")
    supplier_b = get_or_create_supplier(db_session, restaurant_b.id, "בשר הצפון")

    invoice = Invoice(
        restaurant_id=restaurant_a.id,
        supplier_id=supplier_a.id,
        invoice_number="10492",
        invoice_date=date(2026, 6, 1),
        source_type="image",
        status="processed",
    )
    db_session.add(invoice)
    db_session.flush()

    # Same invoice_number, but for a different restaurant/supplier - not a duplicate.
    result = repository.find_duplicate_invoice(db_session, restaurant_b.id, supplier_b.id, "10492")

    assert result is None
