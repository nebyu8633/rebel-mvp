"""Thin data-access helpers.

Every query here that touches restaurant-owned data is filtered by
restaurant_id, keeping data isolation enforced in one place rather than
scattered across callers.
"""
from sqlalchemy.orm import Session

from app.db.models import Invoice, InvoiceItem, Restaurant


def get_restaurant_by_whatsapp_phone(db: Session, phone: str) -> Restaurant | None:
    return db.query(Restaurant).filter(Restaurant.whatsapp_phone == phone).first()


def get_or_create_restaurant_by_whatsapp_phone(
    db: Session, phone: str, default_name: str | None = None
) -> Restaurant:
    restaurant = get_restaurant_by_whatsapp_phone(db, phone)
    if restaurant:
        return restaurant
    restaurant = Restaurant(name=default_name or phone, whatsapp_phone=phone)
    db.add(restaurant)
    db.flush()
    return restaurant


def find_duplicate_invoice(
    db: Session, restaurant_id: int, supplier_id: int, invoice_number: str | None
) -> Invoice | None:
    """Duplicate check: same restaurant + supplier + invoice_number.

    An invoice with no invoice_number can never be matched as a duplicate -
    there's nothing reliable to compare.
    """
    if not invoice_number:
        return None
    return (
        db.query(Invoice)
        .filter(
            Invoice.restaurant_id == restaurant_id,
            Invoice.supplier_id == supplier_id,
            Invoice.invoice_number == invoice_number,
        )
        .first()
    )


def create_invoice(db: Session, **kwargs) -> Invoice:
    invoice = Invoice(**kwargs)
    db.add(invoice)
    db.flush()
    return invoice


def create_invoice_item(db: Session, **kwargs) -> InvoiceItem:
    item = InvoiceItem(**kwargs)
    db.add(item)
    db.flush()
    return item
