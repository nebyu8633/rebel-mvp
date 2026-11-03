"""Local, no-setup-required demo of the Invoice Guard pipeline.

Runs entirely against an in-memory SQLite database and does NOT call the
real Vision LLM - it feeds two invoice fixtures (a baseline price, then a
price spike) straight through matching + Price Guard, and prints exactly
the WhatsApp message a restaurant owner would receive for each one.

This proves the deterministic core (matching, price comparison, alerting,
message formatting) works without needing any API keys, WhatsApp setup, or
PostgreSQL. Run it with:

    python scripts/demo_local.py

To test the real Vision LLM call instead of a fixture, set AI_API_KEY and
use `python scripts/demo_local.py --real-ai <path-to-invoice-image>`.
"""
import argparse
import json
import sys
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import Settings
from app.db.database import Base
from app.db.models import Restaurant
from app.schemas.invoice import InvoiceExtractionResult
from app.services import invoice_service

FIXTURES = Path(__file__).resolve().parent.parent / "tests" / "fixtures"


def make_test_db():
    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def print_message(title: str, result) -> None:
    print(f"\n{'=' * 60}\n{title}  (status={result.status})\n{'=' * 60}")
    print(result.message)


def run_fixture_demo():
    settings = Settings(
        ai_api_key="unused-in-fixture-mode",
        whatsapp_access_token="unused",
        whatsapp_phone_number_id="unused",
        whatsapp_verify_token="unused",
    )
    db = make_test_db()
    restaurant = Restaurant(name="מסעדת הדוגמה", whatsapp_phone="+972500000000")
    db.add(restaurant)
    db.flush()

    def load(name: str) -> InvoiceExtractionResult:
        data = json.loads((FIXTURES / name).read_text(encoding="utf-8"))
        return InvoiceExtractionResult.model_validate(data)

    # Invoice 1: first-ever purchase -> baseline price, no alert possible yet.
    invoice_service.extract_invoice = lambda *a, **k: load("invoice_meat_baseline.json")
    result1 = invoice_service.process_invoice(
        db, restaurant, b"fake-bytes-1", "image/jpeg", "image", settings=settings
    )
    print_message("Invoice #1 - baseline (109 NIS/kg)", result1)

    # Invoice 2: same supplier/product, price jumped to 120 -> should alert.
    invoice_service.extract_invoice = lambda *a, **k: load("invoice_meat_price_spike.json")
    result2 = invoice_service.process_invoice(
        db, restaurant, b"fake-bytes-2", "image/jpeg", "image", settings=settings
    )
    print_message("Invoice #2 - price spike (120 NIS/kg)", result2)

    # Invoice 3: send invoice #1's number again -> must be rejected as duplicate.
    invoice_service.extract_invoice = lambda *a, **k: load("invoice_meat_baseline.json")
    result3 = invoice_service.process_invoice(
        db, restaurant, b"fake-bytes-3", "image/jpeg", "image", settings=settings
    )
    print_message("Invoice #3 - resending invoice #1 (duplicate)", result3)

    print("\nAll three scenarios ran without errors. This is what a real WhatsApp")
    print("reply would contain for each case.\n")


def run_real_ai_demo(image_path: str):
    from app.config import get_settings

    settings = get_settings()
    if not settings.ai_api_key:
        print("AI_API_KEY is not set. Export it or put it in .env, then re-run.")
        sys.exit(1)

    db = make_test_db()
    restaurant = Restaurant(name="מסעדת הדוגמה", whatsapp_phone="+972500000000")
    db.add(restaurant)
    db.flush()

    file_bytes = Path(image_path).read_bytes()
    mime_type = "application/pdf" if image_path.lower().endswith(".pdf") else "image/jpeg"

    result = invoice_service.process_invoice(
        db, restaurant, file_bytes, mime_type, "pdf" if mime_type == "application/pdf" else "image", settings=settings
    )
    print_message(f"Real Vision LLM extraction of {image_path}", result)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--real-ai", metavar="IMAGE_OR_PDF_PATH", help="Call the real Vision LLM on this file instead of using fixtures")
    args = parser.parse_args()

    if args.real_ai:
        run_real_ai_demo(args.real_ai)
    else:
        run_fixture_demo()
