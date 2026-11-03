import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { getAiConfig } from "@/lib/config/env";
import { MissingEnvError } from "@/lib/config/env";

import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_USER_PROMPT } from "./prompts";
import {
  ExtractionError,
  PDF_TYPE,
  SUPPORTED_IMAGE_TYPES,
  isSupportedMimeType,
  type ExtractionInput,
  type InvoiceExtractionProvider,
} from "./provider";
import { InvoiceExtractionSchema, sanitizeExtraction, type InvoiceExtraction } from "./schema";

/**
 * Generous but bounded. A dense supplier invoice can run to a hundred line
 * items; truncating the response mid-array would silently drop real purchases
 * from the price history.
 */
const MAX_TOKENS = 16_000;

function toBase64(data: Uint8Array): string {
  return Buffer.from(data).toString("base64");
}

/**
 * Builds the content block for the document.
 *
 * PDFs go in as `document` blocks and images as `image` blocks — the block
 * type must match the file's actual MIME type, not be inferred from the
 * extension a user happened to upload.
 */
function buildDocumentBlock(input: ExtractionInput): Anthropic.ContentBlockParam {
  const data = toBase64(input.data);

  if (input.mimeType === PDF_TYPE) {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data },
    };
  }

  return {
    type: "image",
    source: {
      type: "base64",
      media_type: input.mimeType as (typeof SUPPORTED_IMAGE_TYPES)[number],
      data,
    },
  };
}

/**
 * Vision extraction backed by Anthropic Claude.
 *
 * Uses `messages.parse()` with a Zod output format, so the model is
 * constrained to the schema at the API level rather than merely asked to
 * follow it in the prompt. A response that does not parse is an error, never
 * a best-effort salvage of whatever text came back.
 */
export class AnthropicExtractionProvider implements InvoiceExtractionProvider {
  readonly name = "anthropic";

  async extract(input: ExtractionInput): Promise<InvoiceExtraction> {
    if (!isSupportedMimeType(input.mimeType)) {
      throw new ExtractionError(
        "unsupported_type",
        `Unsupported file type: ${input.mimeType}`,
      );
    }

    let config;
    try {
      config = getAiConfig();
    } catch (error) {
      if (error instanceof MissingEnvError) {
        throw new ExtractionError("not_configured", error.message, { cause: error });
      }
      throw error;
    }

    const client = new Anthropic({ apiKey: config.apiKey });

    let response;
    try {
      response = await client.messages.parse({
        model: config.model,
        max_tokens: MAX_TOKENS,
        system: EXTRACTION_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              buildDocumentBlock(input),
              { type: "text", text: EXTRACTION_USER_PROMPT },
            ],
          },
        ],
        output_config: { format: zodOutputFormat(InvoiceExtractionSchema) },
      });
    } catch (error) {
      // Error classes first, most specific to least, so a rate limit is never
      // reported to the user as an unreadable invoice.
      if (error instanceof Anthropic.AuthenticationError) {
        throw new ExtractionError("not_configured", "AI credentials rejected.", {
          cause: error,
        });
      }
      if (error instanceof Anthropic.RateLimitError) {
        throw new ExtractionError("provider_error", "AI rate limit reached.", {
          cause: error,
        });
      }
      if (error instanceof Anthropic.APIError) {
        throw new ExtractionError("provider_error", "AI request failed.", {
          cause: error,
        });
      }
      throw new ExtractionError("provider_error", "AI request failed.", { cause: error });
    }

    // The model declined the request. Treat as unreadable rather than
    // retrying, and never surface the refusal text to the user.
    if (response.stop_reason === "refusal") {
      throw new ExtractionError("unreadable", "Model declined to process the document.");
    }

    const parsed = response.parsed_output;
    if (parsed === null || parsed === undefined) {
      throw new ExtractionError(
        "invalid_output",
        "Model response did not match the extraction schema.",
      );
    }

    const extraction = sanitizeExtraction(parsed);

    // A document with no line items is not a usable invoice. Saving it would
    // create an invoice row that contributes nothing and misleads the counts.
    if (extraction.items.length === 0) {
      throw new ExtractionError("unreadable", "No line items found in the document.");
    }

    return extraction;
  }
}
