"""WhatsApp webhook endpoints.

GET  /webhook/whatsapp  - Meta's webhook verification handshake.
POST /webhook/whatsapp  - inbound messages. Image/PDF invoices are handed
                          off to a background task so the webhook responds
                          immediately (WhatsApp expects a fast 200 OK).
"""
import json
import logging

from fastapi import APIRouter, BackgroundTasks, Request, Response
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.db.database import SessionLocal
from app.db import repository
from app.services import invoice_service, whatsapp_service
from app.services.whatsapp_service import IncomingMessage

logger = logging.getLogger(__name__)

router = APIRouter()

_UNSUPPORTED_TYPE_MESSAGE = (
    "שלום! אני קולט חשבוניות ספקים בתמונה או ב-PDF.\n\n"
    "אנא שלח תמונה ברורה של החשבונית או קובץ PDF."
)


@router.get("/webhook/whatsapp")
async def verify_whatsapp_webhook(request: Request) -> Response:
    settings = get_settings()
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    result = whatsapp_service.verify_webhook(mode, token, challenge, settings)
    if result is None:
        return Response(status_code=403)
    return Response(content=result, media_type="text/plain")


@router.post("/webhook/whatsapp")
async def receive_whatsapp_webhook(
    request: Request, background_tasks: BackgroundTasks
) -> Response:
    settings = get_settings()

    # Read the raw bytes and verify the signature BEFORE parsing. Meta signs
    # exactly what it sent; parsing and re-serializing would change the bytes
    # and the digest would never match.
    #
    # This check is what stops an unauthenticated caller from writing to a
    # restaurant's price history: without it, anyone who knows this URL could
    # post a payload naming any phone number and inject fabricated invoices.
    raw_body = await request.body()
    signature = request.headers.get(whatsapp_service.SIGNATURE_HEADER)

    if not whatsapp_service.verify_signature(raw_body, signature, settings):
        logger.warning("Rejected WhatsApp webhook with missing or invalid signature")
        return JSONResponse({"status": "forbidden"}, status_code=403)

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        return JSONResponse({"status": "bad_request"}, status_code=400)

    message = whatsapp_service.parse_incoming_message(payload)

    if message is None:
        return JSONResponse({"status": "ignored"})

    background_tasks.add_task(_handle_incoming_message, message)
    return JSONResponse({"status": "received"})


def _handle_incoming_message(message: IncomingMessage) -> None:
    """Runs after the webhook response has been sent. Owns its own DB
    session since the request-scoped session is already closed by then.
    """
    settings = get_settings()
    db = SessionLocal()
    try:
        if message.kind == "unsupported":
            whatsapp_service.send_text_message(message.from_phone, _UNSUPPORTED_TYPE_MESSAGE, settings)
            return

        restaurant = repository.get_or_create_restaurant_by_whatsapp_phone(db, message.from_phone)
        db.commit()

        file_bytes, mime_type = whatsapp_service.download_media(message.media_id, settings)

        result = invoice_service.process_invoice(
            db,
            restaurant=restaurant,
            file_bytes=file_bytes,
            mime_type=mime_type,
            source_type=message.kind,
        )

        whatsapp_service.send_text_message(message.from_phone, result.message, settings)
    except Exception:
        logger.exception("Failed to process incoming WhatsApp invoice from %s", message.from_phone)
        whatsapp_service.send_text_message(
            message.from_phone,
            "⚠️ אירעה שגיאה בעיבוד החשבונית. נסה שוב מאוחר יותר.",
            settings,
        )
    finally:
        db.close()
