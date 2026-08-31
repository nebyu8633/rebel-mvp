"""WhatsApp Business Cloud API integration: parsing incoming webhook
payloads, downloading media, sending text replies, and verifying the
webhook handshake. No business logic lives here - only transport.
"""
import hashlib
import hmac
import logging
from dataclasses import dataclass

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)

SUPPORTED_MEDIA_KINDS = {"image": "image", "document": "pdf"}


@dataclass
class IncomingMessage:
    from_phone: str
    kind: str  # "image" | "pdf" | "unsupported"
    media_id: str | None
    mime_type: str | None


SIGNATURE_HEADER = "X-Hub-Signature-256"
_SIGNATURE_PREFIX = "sha256="


def verify_signature(raw_body: bytes, signature_header: str | None, settings: Settings) -> bool:
    """Verify Meta's X-Hub-Signature-256 over the raw request body.

    Meta signs every webhook delivery with HMAC-SHA256 of the exact bytes it
    sent, keyed by the app secret. The check must run against the raw body:
    parsing and re-serializing the JSON changes whitespace and key order, so
    the digest would never match.

    Returns False when the app secret is unset. That is deliberate - an
    unconfigured deployment must reject inbound webhooks rather than silently
    accept unauthenticated ones, because this endpoint can write to a
    restaurant's price history.
    """
    if not settings.whatsapp_app_secret:
        logger.error(
            "WHATSAPP_APP_SECRET is not set; rejecting inbound webhook. "
            "Set it to the Meta app secret to enable signature verification."
        )
        return False

    if not signature_header or not signature_header.startswith(_SIGNATURE_PREFIX):
        return False

    expected = hmac.new(
        settings.whatsapp_app_secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    provided = signature_header[len(_SIGNATURE_PREFIX):]

    # Constant-time compare so a timing side channel cannot leak the digest.
    return hmac.compare_digest(expected, provided)


def verify_webhook(mode: str | None, token: str | None, challenge: str | None, settings: Settings) -> str | None:
    """WhatsApp webhook verification handshake (GET request).

    Returns the challenge string to echo back if verification succeeds,
    otherwise None.
    """
    if mode == "subscribe" and token == settings.whatsapp_verify_token and challenge is not None:
        return challenge
    return None


def parse_incoming_message(payload: dict) -> IncomingMessage | None:
    """Extract the first inbound message from a WhatsApp webhook payload.

    Returns None for events that are not an inbound user message (e.g.
    delivery/read status callbacks), which should simply be ignored.
    """
    try:
        entry = payload["entry"][0]
        change = entry["changes"][0]
        value = change["value"]
        messages = value.get("messages")
        if not messages:
            return None
        message = messages[0]
    except (KeyError, IndexError, TypeError):
        return None

    from_phone = message.get("from")
    msg_type = message.get("type")

    if not from_phone:
        return None

    if msg_type not in SUPPORTED_MEDIA_KINDS:
        return IncomingMessage(from_phone=from_phone, kind="unsupported", media_id=None, mime_type=None)

    media_obj = message.get(msg_type) or {}
    media_id = media_obj.get("id")
    mime_type = media_obj.get("mime_type")

    if not media_id:
        return IncomingMessage(from_phone=from_phone, kind="unsupported", media_id=None, mime_type=None)

    return IncomingMessage(
        from_phone=from_phone,
        kind=SUPPORTED_MEDIA_KINDS[msg_type],
        media_id=media_id,
        mime_type=mime_type,
    )


def download_media(media_id: str, settings: Settings) -> tuple[bytes, str]:
    """Fetch a media file from WhatsApp: look up its temporary URL, then
    download the bytes. Returns (file_bytes, mime_type)."""
    headers = {"Authorization": f"Bearer {settings.whatsapp_access_token}"}

    with httpx.Client(timeout=30) as client:
        meta_resp = client.get(f"{settings.whatsapp_api_base_url}/{media_id}", headers=headers)
        meta_resp.raise_for_status()
        meta = meta_resp.json()

        media_url = meta["url"]
        mime_type = meta.get("mime_type", "application/octet-stream")

        file_resp = client.get(media_url, headers=headers, timeout=60)
        file_resp.raise_for_status()

    return file_resp.content, mime_type


def send_text_message(to_phone: str, text: str, settings: Settings) -> bool:
    """Send a plain-text WhatsApp reply. Returns True on success.

    Failures are logged (never raised to the caller and never logged with
    the access token) since a failed outbound message must not crash the
    webhook handler.
    """
    url = f"{settings.whatsapp_api_base_url}/{settings.whatsapp_phone_number_id}/messages"
    headers = {"Authorization": f"Bearer {settings.whatsapp_access_token}"}
    payload = {
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "text",
        "text": {"body": text},
    }

    try:
        with httpx.Client(timeout=20) as client:
            response = client.post(url, headers=headers, json=payload)
            response.raise_for_status()
        return True
    except httpx.HTTPError as exc:
        logger.error("Failed to send WhatsApp message to %s: %s", to_phone, exc)
        return False
