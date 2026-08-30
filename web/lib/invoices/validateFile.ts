/**
 * Upload validation (spec §15).
 *
 * Runs in the browser for immediate feedback and again on the server before
 * anything is stored — client-side validation is a convenience, never a
 * security control, since the request can be made directly.
 */

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_ANALYSIS = 10;

export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

/** For the file picker's `accept` attribute. */
export const ACCEPT_ATTRIBUTE = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

/**
 * Extensions that must never be accepted regardless of the declared MIME type
 * (spec §15). A browser will happily report `application/pdf` for a file the
 * user renamed, so the extension is checked independently.
 */
const BLOCKED_EXTENSIONS = [
  ".exe", ".bat", ".cmd", ".com", ".scr", ".msi", ".dll", ".sh", ".bash",
  ".ps1", ".vbs", ".js", ".mjs", ".jar", ".app", ".dmg", ".deb", ".rpm",
  ".apk", ".bin", ".pif", ".gadget", ".wsf", ".php", ".py", ".rb",
] as const;

export type FileValidationError =
  | "tooLarge"
  | "wrongType"
  | "executable"
  | "tooMany"
  | "empty";

export interface FileValidationResult {
  ok: boolean;
  /** A key into `he.validation`, so the message shown is always Hebrew copy. */
  errorKey?: FileValidationError;
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

/**
 * Validates one file.
 *
 * `existingCount` is how many files are already selected, so the per-analysis
 * cap is enforced as files are added rather than only on submit.
 */
export function validateFile(
  file: { name: string; size: number; type: string },
  existingCount = 0,
): FileValidationResult {
  if (existingCount >= MAX_FILES_PER_ANALYSIS) {
    return { ok: false, errorKey: "tooMany" };
  }

  // Extension first: a renamed executable can declare any MIME type it likes.
  if (BLOCKED_EXTENSIONS.includes(extensionOf(file.name) as never)) {
    return { ok: false, errorKey: "executable" };
  }

  if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, errorKey: "wrongType" };
  }

  if (file.size <= 0) return { ok: false, errorKey: "empty" };
  if (file.size > MAX_FILE_SIZE_BYTES) return { ok: false, errorKey: "tooLarge" };

  return { ok: true };
}

/**
 * Verifies the file's actual leading bytes match its declared type.
 *
 * The declared MIME type comes from the client and can be anything, so before
 * a file is handed to the vision model its magic number is checked. A PDF
 * always starts with `%PDF-`, a JPEG with FF D8 FF, a PNG with its 8-byte
 * signature.
 */
export function sniffMimeType(bytes: Uint8Array): string | null {
  if (bytes.length >= 5) {
    if (
      bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 &&
      bytes[3] === 0x46 && bytes[4] === 0x2d
    ) {
      return "application/pdf";
    }
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  return null;
}

/** Human-readable size for the file list, e.g. "2.4MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
