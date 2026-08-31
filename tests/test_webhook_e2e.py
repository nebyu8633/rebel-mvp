"""Full webhook-to-database-to-reply round trip using FastAPI's TestClient.
Only the outbound network calls (Vision LLM, WhatsApp media download/send)
are mocked - everything else (routing, DB session, matching, price guard,
message formatting) runs for real."""
import hashlib
import hmac
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
from app.db.models import Restaurant
from app.schemas.invoice import InvoiceExtractionResult
from app.services import invoice_service, whatsapp_service

FIXTURES = Path(__file__).parent / "fixtures"

TEST_APP_SECRET = "test-app-secret"


def _sign(body: bytes, secret: str = TEST_APP_SECRET) -> str:
    """Produce the header Meta would send for this exact body."""
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def _post_signed(test_client, payload: dict, secret: str = TEST_APP_SECRET):
    """POST a payload the way Meta does: raw bytes plus a matching signature.

    The body is serialized once and both signed and sent, because the
    signature covers the exact bytes on the wire.
    """
    body = json.dumps(payload).encode("utf-8")
    return test_client.post(
        "/webhook/whatsapp",
        content=body,
        headers={
            "Content-Type": "application/json",
            whatsapp_service.SIGNATURE_HEADER: _sign(body, secret),
        },
    )


@pytest.fixture()
def client(monkeypatch):
    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    test_session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    monkeypatch.setattr(whatsapp_api, "SessionLocal", test_session_factory)

    # Signature verification is on by default, so the fixture configures a
    # known secret. monkeypatch restores it, keeping tests independent.
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "whatsapp_app_secret", TEST_APP_SECRET)

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

    resp = _post_signed(client, payload)

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

    resp = _post_signed(client, status_payload)

    assert resp.status_code == 200
    assert resp.json()["status"] == "ignored"
    assert client.sent_messages == []


# ---------------------------------------------------------------------------
# Signature verification.
#
# This endpoint can write to a restaurant's price history, so an unauthenticated
# caller must not reach any of that logic. Each test asserts both the rejection
# and the absence of side effects.
# ---------------------------------------------------------------------------


def _restaurant_count(test_client) -> int:
    """Rows in `restaurants`, read through the same session the app uses."""
    session = whatsapp_api.SessionLocal()
    try:
        return session.query(Restaurant).count()
    finally:
        session.close()


def test_unsigned_post_is_rejected_and_writes_nothing(client):
    payload = _webhook_payload("+972501234567")

    resp = client.post("/webhook/whatsapp", json=payload)

    assert resp.status_code == 403
    # The damaging outcome is a fabricated invoice landing in someone's price
    # history, so assert the request never got far enough to create anything.
    assert _restaurant_count(client) == 0
    assert client.sent_messages == []


def test_post_with_wrong_signature_is_rejected(client):
    payload = _webhook_payload("+972501234567")

    resp = _post_signed(client, payload, secret="not-the-app-secret")

    assert resp.status_code == 403
    assert _restaurant_count(client) == 0
    assert client.sent_messages == []


def test_signature_over_a_different_body_is_rejected(client):
    """A valid signature for one payload must not authorize another.

    Guards against verifying the digest against re-serialized JSON instead of
    the bytes actually received.
    """
    signed_body = json.dumps(_webhook_payload("+972500000000")).encode("utf-8")
    tampered_body = json.dumps(_webhook_payload("+972501234567")).encode("utf-8")

    resp = client.post(
        "/webhook/whatsapp",
        content=tampered_body,
        headers={
            "Content-Type": "application/json",
            whatsapp_service.SIGNATURE_HEADER: _sign(signed_body),
        },
    )

    assert resp.status_code == 403
    assert _restaurant_count(client) == 0


def test_malformed_signature_header_is_rejected(client):
    payload = _webhook_payload("+972501234567")
    body = json.dumps(payload).encode("utf-8")

    for header in ("", "garbage", "sha1=abc", _sign(body).removeprefix("sha256=")):
        resp = client.post(
            "/webhook/whatsapp",
            content=body,
            headers={
                "Content-Type": "application/json",
                whatsapp_service.SIGNATURE_HEADER: header,
            },
        )
        assert resp.status_code == 403, f"accepted malformed header: {header!r}"

    assert _restaurant_count(client) == 0


def test_rejects_everything_when_app_secret_is_unset(client, monkeypatch):
    """An unconfigured deployment must fail closed, not open."""
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "whatsapp_app_secret", "")

    payload = _webhook_payload("+972501234567")
    body = json.dumps(payload).encode("utf-8")

    resp = client.post(
        "/webhook/whatsapp",
        content=body,
        headers={
            "Content-Type": "application/json",
            # Even a signature computed with the empty secret must not pass.
            whatsapp_service.SIGNATURE_HEADER: _sign(body, secret=""),
        },
    )

    assert resp.status_code == 403
    assert _restaurant_count(client) == 0


def test_signed_but_malformed_json_is_a_bad_request(client):
    body = b"{not valid json"

    resp = client.post(
        "/webhook/whatsapp",
        content=body,
        headers={
            "Content-Type": "application/json",
            whatsapp_service.SIGNATURE_HEADER: _sign(body),
        },
    )

    assert resp.status_code == 400
    assert _restaurant_count(client) == 0
