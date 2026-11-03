"""SQLAlchemy ORM models.

Every table that stores restaurant data carries a `restaurant_id` foreign key.
All repository/query code MUST filter by `restaurant_id` so that one
restaurant's suppliers, products, invoices and prices are never visible to
another restaurant.
"""
from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Restaurant(Base):
    __tablename__ = "restaurants"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    whatsapp_phone: Mapped[str] = mapped_column(String(32), nullable=False, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    suppliers: Mapped[list["Supplier"]] = relationship(back_populates="restaurant")
    products: Mapped[list["Product"]] = relationship(back_populates="restaurant")
    invoices: Mapped[list["Invoice"]] = relationship(back_populates="restaurant")


class Supplier(Base):
    __tablename__ = "suppliers"
    __table_args__ = (
        UniqueConstraint("restaurant_id", "normalized_name", name="uq_supplier_restaurant_normalized_name"),
        Index("ix_suppliers_restaurant_id", "restaurant_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    restaurant: Mapped["Restaurant"] = relationship(back_populates="suppliers")
    invoices: Mapped[list["Invoice"]] = relationship(back_populates="supplier")


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        UniqueConstraint("restaurant_id", "normalized_name", name="uq_product_restaurant_normalized_name"),
        Index("ix_products_restaurant_id", "restaurant_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    canonical_name: Mapped[str] = mapped_column(String(255), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(255), nullable=False)
    default_unit: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    restaurant: Mapped["Restaurant"] = relationship(back_populates="products")
    invoice_items: Mapped[list["InvoiceItem"]] = relationship(back_populates="product")


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint(
            "restaurant_id", "supplier_id", "invoice_number",
            name="uq_invoice_restaurant_supplier_number",
        ),
        Index("ix_invoices_restaurant_id", "restaurant_id"),
        Index("ix_invoices_supplier_id", "supplier_id"),
        Index("ix_invoices_invoice_date", "invoice_date"),
        Index("ix_invoices_invoice_number", "invoice_number"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False)
    invoice_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    invoice_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    subtotal: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    tax: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    total: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)  # "image" | "pdf"
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    extraction_confidence: Mapped[float | None] = mapped_column(Numeric(4, 3), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="processed")
    # "processed" | "processing_failed" | "needs_review"
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    restaurant: Mapped["Restaurant"] = relationship(back_populates="invoices")
    supplier: Mapped["Supplier"] = relationship(back_populates="invoices")
    items: Mapped[list["InvoiceItem"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")


class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    __table_args__ = (
        Index("ix_invoice_items_invoice_id", "invoice_id"),
        Index("ix_invoice_items_product_id", "product_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    raw_name: Mapped[str] = mapped_column(String(255), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[float | None] = mapped_column(Numeric(12, 3), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(32), nullable=True)
    unit_price: Mapped[float | None] = mapped_column(Numeric(12, 4), nullable=True)
    total_price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    confidence: Mapped[float] = mapped_column(Numeric(4, 3), nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    invoice: Mapped["Invoice"] = relationship(back_populates="items")
    product: Mapped["Product | None"] = relationship(back_populates="invoice_items")
    alerts: Mapped[list["PriceAlert"]] = relationship(back_populates="invoice_item", cascade="all, delete-orphan")


class PriceAlert(Base):
    __tablename__ = "price_alerts"
    __table_args__ = (
        Index("ix_price_alerts_invoice_item_id", "invoice_item_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_item_id: Mapped[int] = mapped_column(
        ForeignKey("invoice_items.id", ondelete="CASCADE"), nullable=False
    )
    previous_price: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    current_price: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    percentage_change: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False)
    estimated_impact: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)  # "warning" | "critical"
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    invoice_item: Mapped["InvoiceItem"] = relationship(back_populates="alerts")
