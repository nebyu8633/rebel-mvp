"""End-to-end test of the invoice pipeline using real invoice fixtures,
with only the Vision LLM call mocked out (no network calls in tests)."""
import json
from pathlib import Path

import pytest

from app.schemas.invoice import InvoiceExtractionResult
from app.services import invoice_service

FIXTURES = Path(__file__).parent / "fixtures"


def load_extraction(name: str) -> InvoiceExtractionResult:
    data = json.loads((FIXTURES / name).read_text(encoding="utf-8"))
    return InvoiceExtractionResult.model_validate(data)


@pytest.fixture()
def mock_extractor(monkeypatch):
    """Replaces the Vision LLM call with a fixed fixture, keyed by filename."""
    queue: list[InvoiceExtractionResult] = []

    def _fake_extract(file_bytes, mime_type, settings=None):
        return queue.pop(0)

    monkeypatch.setattr(invoice_service, "extract_invoice", _fake_extract)
    return queue


def test_first_invoice_registers_baseline_price(db_session, make_restaurant, settings, mock_extractor):
    restaurant = make_restaurant()
    mock_extractor.append(load_extraction("invoice_meat_baseline.json"))

    result = invoice_service.process_invoice(
        db_session, restaurant, b"fake-bytes", "image/jpeg", source_type="image", settings=settings
    )

    assert result.status == invoice_service.STATUS_PROCESSED
    assert "נרשם מחיר בסיס ראשון" in result.message
    assert "✅" in result.message
    assert result.invoice is not None
    assert result.invoice.invoice_number == "10492"


def test_second_invoice_with_price_spike_triggers_alert(db_session, make_restaurant, settings, mock_extractor):
    restaurant = make_restaurant()
    mock_extractor.append(load_extraction("invoice_meat_baseline.json"))
    mock_extractor.append(load_extraction("invoice_meat_price_spike.json"))

    first = invoice_service.process_invoice(
        db_session, restaurant, b"fake-bytes-1", "image/jpeg", source_type="image", settings=settings
    )
    second = invoice_service.process_invoice(
        db_session, restaurant, b"fake-bytes-2", "image/jpeg", source_type="image", settings=settings
    )

    assert first.status == invoice_service.STATUS_PROCESSED
    assert second.status == invoice_service.STATUS_PROCESSED
    assert "⚠️ נמצאה חריגת מחיר" in second.message
    assert "אנטריקוט טרי מיוחד" in second.message
    assert "109.00" in second.message
    assert "120.00" in second.message
    assert "עלות נוספת משוערת" in second.message
    assert "110.00" in second.message
    assert "בדוק מול הספק" in second.message


def test_duplicate_invoice_is_rejected_by_service(db_session, make_restaurant, settings, mock_extractor):
    restaurant = make_restaurant()
    mock_extractor.append(load_extraction("invoice_meat_baseline.json"))
    mock_extractor.append(load_extraction("invoice_meat_baseline.json"))

    first = invoice_service.process_invoice(
        db_session, restaurant, b"fake-bytes-1", "image/jpeg", source_type="image", settings=settings
    )
    second = invoice_service.process_invoice(
        db_session, restaurant, b"fake-bytes-2", "image/jpeg", source_type="image", settings=settings
    )

    assert first.status == invoice_service.STATUS_PROCESSED
    assert second.status == invoice_service.STATUS_DUPLICATE
    assert "כבר נקלטה" in second.message

    # No second invoice row should have been created.
    from app.db.models import Invoice

    count = (
        db_session.query(Invoice)
        .filter(Invoice.restaurant_id == restaurant.id, Invoice.invoice_number == "10492")
        .count()
    )
    assert count == 1


def test_low_confidence_item_processed_without_automatic_alert(db_session, make_restaurant, settings, mock_extractor):
    restaurant = make_restaurant()
    mock_extractor.append(load_extraction("invoice_low_confidence.json"))

    result = invoice_service.process_invoice(
        db_session, restaurant, b"fake-bytes", "image/jpeg", source_type="image", settings=settings
    )

    assert result.status == invoice_service.STATUS_PROCESSED
    assert "⚠️ נמצאה חריגת מחיר" not in result.message


def test_extraction_failure_does_not_save_invoice(db_session, make_restaurant, settings, monkeypatch):
    from app.ai.extractor import ExtractionError

    def _raise(*args, **kwargs):
        raise ExtractionError("could not read invoice")

    monkeypatch.setattr(invoice_service, "extract_invoice", _raise)
    restaurant = make_restaurant()

    result = invoice_service.process_invoice(
        db_session, restaurant, b"garbage", "image/jpeg", source_type="image", settings=settings
    )

    assert result.status == invoice_service.STATUS_EXTRACTION_FAILED
    assert "לא הצלחתי לקרוא" in result.message
    assert result.invoice is None

    from app.db.models import Invoice

    assert db_session.query(Invoice).count() == 0
