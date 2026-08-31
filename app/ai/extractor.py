"""Vision LLM invoice extraction.

Calls a vision-capable LLM (Anthropic Claude) with the invoice image/PDF and
parses its response into a strictly-validated InvoiceExtractionResult. This
module ONLY extracts data - it never makes a pricing decision.
"""
import base64
import json
import logging
import re

import anthropic
from pydantic import ValidationError

from app.ai.prompts import SYSTEM_PROMPT, USER_PROMPT
from app.config import Settings, get_settings
from app.schemas.invoice import InvoiceExtractionResult

logger = logging.getLogger(__name__)

_SUPPORTED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_PDF_TYPE = "application/pdf"

_JSON_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


class ExtractionError(Exception):
    """Raised when the invoice could not be read reliably."""


def _build_content_block(file_bytes: bytes, mime_type: str) -> dict:
    encoded = base64.b64encode(file_bytes).decode("ascii")

    if mime_type == _PDF_TYPE:
        return {
            "type": "document",
            "source": {"type": "base64", "media_type": mime_type, "data": encoded},
        }
    if mime_type in _SUPPORTED_IMAGE_TYPES:
        return {
            "type": "image",
            "source": {"type": "base64", "media_type": mime_type, "data": encoded},
        }
    raise ExtractionError(f"unsupported file type: {mime_type}")


def _strip_json_fences(text: str) -> str:
    return _JSON_FENCE_RE.sub("", text.strip()).strip()


def extract_invoice(
    file_bytes: bytes, mime_type: str, settings: Settings | None = None
) -> InvoiceExtractionResult:
    """Send an invoice image/PDF to the Vision LLM and return validated,
    structured data. Raises ExtractionError if the document cannot be read
    or the model output does not validate against the schema.
    """
    settings = settings or get_settings()

    if not settings.ai_api_key:
        raise ExtractionError("AI_API_KEY is not configured")

    content_block = _build_content_block(file_bytes, mime_type)
    client = anthropic.Anthropic(api_key=settings.ai_api_key)

    try:
        response = client.messages.create(
            model=settings.ai_model,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": [content_block, {"type": "text", "text": USER_PROMPT}],
                }
            ],
        )
    except anthropic.APIError as exc:
        logger.error("Vision LLM request failed: %s", exc)
        raise ExtractionError("vision LLM request failed") from exc

    text_blocks = [block.text for block in response.content if getattr(block, "type", None) == "text"]
    raw_text = "".join(text_blocks).strip()

    if not raw_text:
        raise ExtractionError("empty response from vision LLM")

    cleaned = _strip_json_fences(raw_text)

    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        logger.error("Vision LLM did not return valid JSON: %s", raw_text[:500])
        raise ExtractionError("model did not return valid JSON") from exc

    try:
        return InvoiceExtractionResult.model_validate(payload)
    except ValidationError as exc:
        logger.error("Vision LLM JSON failed schema validation: %s", exc)
        raise ExtractionError("extracted data failed validation") from exc
