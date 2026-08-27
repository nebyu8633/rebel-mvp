"""Full webhook-to-database-to-reply round trip using FastAPI's TestClient.
Only the outbound network calls (Vision LLM, WhatsApp media download/send)
are mocked - everything else (routing, DB session, matching, price guard,
message formatting) runs for real."""
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as app_main
from app.api import whatsapp as whatsapp_api
from app.db.database import Base
from app.schemas.invoice import InvoiceExtractionResult
from app.services import invoice_service

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture()
def client(monkeypatch):
    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    test_session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    monkeypatch.setattr(whatsapp_api, "SessionLocal", test_session_factory)

    sent_messages = []
    monkeypatch.setattr(
        whatsapp_api.whatsapp_service,
        "send_text_message",
        lambda to, text, settings: sent_messages.append((to, text)) or True,
    )

    def fake_download_media(media_id, settings):
        return b"fake-file-bytes", "image/jpeg"

    monkeypatch.setattr(whatsapp_api.whatsapp_service, "download_media", fake_download_media)

    data = json.loads((FIXTURES / "invoice_meat_baseline.json").read_text(encoding="utf-8"))
    extraction = InvoiceExtractionResult.model_validate(data)
    monkeypatch.setattr(invoice_service, "extract_invoice", lambda *a, **k: extraction)

    with TestClient(app_main.app) as test_client:
        test_client.sent_messages = sent_messages
        yield test_client

    Base.metadata.drop_all(engine)


def _webhook_payload(phone: str, media_id: str = "media-1") -> dict:
    return {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "messages": [
                                {
                                    "from": phone,
                                    "type": "image",
                                    "image": {"id": media_id, "mime_type": "image/jpeg"},
                                }
                            ]
                        }
                    }
                ]
            }
        ]
    }


def test_webhook_verification_handshake(monkeypatch):
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(whatsapp_api, "get_settings", lambda: settings)
    settings.whatsapp_verify_token = "verify-me"

    with TestClient(app_main.app) as test_client:
        resp = test_client.get(
            "/webhook/whatsapp",
            params={"hub.mode": "subscribe", "hub.verify_token": "verify-me", "hub.challenge": "12345"},
        )

    assert resp.status_code == 200
    assert resp.text == "12345"


def test_webhook_verification_rejects_wrong_token():
    with TestClient(app_main.app) as test_client:
        resp = test_client.get(
            "/webhook/whatsapp",
            params={"hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "12345"},
        )

    assert resp.status_code == 403


def test_incoming_invoice_image_is_processed_and_replied_to(client):
    payload = _webhook_payload("+972501234567")

    resp = client.post("/webhook/whatsapp", json=payload)

    assert resp.status_code == 200
    assert resp.json()["status"] == "received"

    assert len(client.sent_messages) == 1
    to, text = client.sent_messages[0]
    assert to == "+972501234567"
    assert "✅" in text
    assert "בשר הצפון" in text


def test_status_callback_events_are_ignored(client):
    status_payload = {
        "entry": [{"changes": [{"value": {"statuses": [{"id": "abc", "status": "delivered"}]}}]}]
    }

    resp = client.post("/webhook/whatsapp", json=status_payload)

    assert resp.status_code == 200
    assert resp.json()["status"] == "ignored"
    assert client.sent_messages == []
