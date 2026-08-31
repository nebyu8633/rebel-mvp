import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export const INVOICE_BUCKET = "invoices";

/** Signed URLs are short-lived: long enough to open a document, not to share it. */
const SIGNED_URL_TTL_SECONDS = 60 * 5;

/**
 * Control characters, built from escapes rather than written literally so the
 * source stays readable and the class cannot be mistaken for the characters
 * it spans (a literal range here reads as "space to hyphen", which would
 * strip spaces out of Hebrew filenames).
 *
 * Matching control characters is the whole point here — stripping them out of
 * an uploaded filename before it becomes a storage key — so the rule that
 * flags them is disabled for this line only, not project-wide.
 */
// oxlint-disable-next-line no-control-regex
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001f\\u007f]", "g");

/** Characters that are illegal or awkward in an object key. */
const UNSAFE_CHARS = /[<>:"|?*]/g;

/**
 * Object path for an uploaded invoice.
 *
 * The first segment is the business id, which is exactly what the storage RLS
 * policies check — so path construction and access control agree by
 * construction rather than by convention.
 */
export function invoiceObjectPath(
  businessId: string,
  invoiceId: string,
  fileName: string,
): string {
  return `${businessId}/${invoiceId}/${sanitizeFileName(fileName)}`;
}

/**
 * Makes a filename safe to use as a storage key.
 *
 * Path separators and traversal sequences are removed so a crafted filename
 * cannot escape its business folder and land somewhere the policies would
 * allow. Hebrew characters and spaces are preserved — most uploads will be
 * named in Hebrew and mangling them would make the file list unreadable.
 */
export function sanitizeFileName(fileName: string): string {
  // Take the last path segment, so "../../etc/passwd" becomes "passwd".
  const base = fileName.split(/[\\/]/).pop() ?? "invoice";

  const cleaned = base
    .replace(/\.{2,}/g, ".")
    .replace(CONTROL_CHARS, "")
    .replace(UNSAFE_CHARS, "")
    .trim();

  const safe = cleaned === "" || cleaned === "." ? "invoice" : cleaned;
  return safe.slice(0, 120);
}

export async function uploadInvoiceFile(
  client: SupabaseClient,
  path: string,
  data: ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await client.storage.from(INVOICE_BUCKET).upload(path, data, {
    contentType,
    // Never overwrite: a collision means a bug in path construction, and
    // silently replacing someone's stored invoice would destroy evidence.
    upsert: false,
  });

  return error === null ? { ok: true } : { ok: false, error: error.message };
}

/**
 * A temporary URL for viewing a stored invoice.
 *
 * The bucket is private, so this is the only way to read a file — there is no
 * public URL to leak.
 */
export async function createSignedInvoiceUrl(
  client: SupabaseClient,
  path: string,
): Promise<string | null> {
  const { data, error } = await client.storage
    .from(INVOICE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  return error === null ? (data?.signedUrl ?? null) : null;
}

export async function deleteInvoiceFile(
  client: SupabaseClient,
  path: string,
): Promise<boolean> {
  const { error } = await client.storage.from(INVOICE_BUCKET).remove([path]);
  return error === null;
}
