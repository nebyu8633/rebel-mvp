"""Pydantic schemas for the structured JSON returned by the Vision LLM.

The LLM is only allowed to EXTRACT data into this exact shape. Any field it
cannot read with confidence must be null - never guessed. All financial
decisions (matching, price comparison, alerting) happen in plain
deterministic Python code downstream, never inside the model output itself.
"""
import datetime as dt

from pydantic import BaseModel, Field, field_validator


class SupplierExtract(BaseModel):
    raw_name: str
    normalized_name: str


class InvoiceHeaderExtract(BaseModel):
    number: str | None = None
    date: dt.date | None = None
    subtotal: float | None = None
    tax: float | None = None
    total: float | None = None


class InvoiceItemExtract(BaseModel):
    raw_name: str
    quantity: float | None = None
    unit: str | None = None
    unit_price: float | None = None
    total_price: float | None = None
    confidence: float = Field(ge=0.0, le=1.0)


class InvoiceExtractionResult(BaseModel):
    """The exact JSON object the Vision LLM must return."""

    supplier: SupplierExtract
    invoice: InvoiceHeaderExtract
    items: list[InvoiceItemExtract]

    @field_validator("items")
    @classmethod
    def must_have_items(cls, items: list[InvoiceItemExtract]) -> list[InvoiceItemExtract]:
        if not items:
            raise ValueError("extraction must contain at least one line item")
        return items


class ExtractionFailed(BaseModel):
    """Returned internally when the LLM output could not be parsed/validated."""

    reason: str
