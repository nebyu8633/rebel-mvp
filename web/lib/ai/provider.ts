import type { InvoiceExtraction } from "./schema";

/**
 * The boundary between "read this document" and the rest of the product.
 *
 * Everything downstream depends only on this interface, so swapping vision
 * providers, or stubbing one out in a test, touches nothing but the
 * implementation. Note what the interface does NOT return: no prices verdicts,
 * no benchmarks, no savings. Extraction only.
 */
export interface InvoiceExtractionProvider {
  readonly name: string;
  extract(input: ExtractionInput): Promise<InvoiceExtraction>;
}

export interface ExtractionInput {
  /** Raw file bytes. */
  data: Uint8Array;
  /** e.g. "image/jpeg", "application/pdf". */
  mimeType: string;
  /** Original filename, used only for error messages. */
  fileName?: string;
}

/**
 * A document could not be read reliably.
 *
 * `reason` drives which Hebrew message the user sees, so failures never
 * surface as a raw provider error or an English stack trace.
 */
export class ExtractionError extends Error {
  readonly reason: ExtractionFailureReason;

  constructor(reason: ExtractionFailureReason, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ExtractionError";
    this.reason = reason;
  }
}

export type ExtractionFailureReason =
  | "unsupported_type"
  | "unreadable"
  | "provider_error"
  | "invalid_output"
  | "not_configured";

export const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const PDF_TYPE = "application/pdf";

export function isSupportedMimeType(mimeType: string): boolean {
  return (
    mimeType === PDF_TYPE ||
    (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(mimeType)
  );
}
