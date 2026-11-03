import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.schemas.invoice import InvoiceExtractionResult

FIXTURES = Path(__file__).parent / "fixtures"


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def test_valid_extraction_parses():
    data = load_fixture("invoice_meat_baseline.json")
    result = InvoiceExtractionResult.model_validate(data)

    assert result.supplier.raw_name == "בשר הצפון"
    assert result.invoice.number == "10492"
    assert result.invoice.total == 1275.3
    assert len(result.items) == 1
    assert result.items[0].unit_price == 109.0
    assert result.items[0].confidence == 0.95


def test_null_fields_are_allowed_not_guessed():
    data = load_fixture("invoice_meat_baseline.json")
    data["invoice"]["number"] = None
    data["invoice"]["date"] = None
    data["items"][0]["quantity"] = None
    data["items"][0]["unit_price"] = None

    result = InvoiceExtractionResult.model_validate(data)

    assert result.invoice.number is None
    assert result.invoice.date is None
    assert result.items[0].quantity is None
    assert result.items[0].unit_price is None


def test_empty_items_list_is_rejected():
    data = load_fixture("invoice_meat_baseline.json")
    data["items"] = []

    with pytest.raises(ValidationError):
        InvoiceExtractionResult.model_validate(data)


def test_confidence_out_of_range_is_rejected():
    data = load_fixture("invoice_meat_baseline.json")
    data["items"][0]["confidence"] = 1.5

    with pytest.raises(ValidationError):
        InvoiceExtractionResult.model_validate(data)


def test_missing_supplier_is_rejected():
    data = load_fixture("invoice_meat_baseline.json")
    del data["supplier"]

    with pytest.raises(ValidationError):
        InvoiceExtractionResult.model_validate(data)


def test_free_text_instead_of_json_is_rejected():
    with pytest.raises(ValidationError):
        InvoiceExtractionResult.model_validate("this is not an invoice, sorry I can't read it")
