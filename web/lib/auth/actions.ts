"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface AuthResult {
  ok: boolean;
  /** A key into `he.auth.errors`, so the message shown is always Hebrew copy. */
  errorKey?: "invalidCredentials" | "emailTaken" | "weakPassword" | "generic";
}

const MIN_PASSWORD_LENGTH = 8;

/**
 * Ensures the visitor has a session before they upload anything.
 *
 * Signing in anonymously up front is what lets someone run an analysis and see
 * their results before creating an account (spec §32) while every row they
 * create is still owned by a real `auth.uid()` and covered by Row Level
 * Security. There is no unowned data at any point.
 */
export async function ensureAnonymousSession(): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user !== null) return { ok: true };

  const { error } = await supabase.auth.signInAnonymously();
  return error === null ? { ok: true } : { ok: false, errorKey: "generic" };
}

/**
 * Turns the current visitor into a permanent account.
 *
 * When they already hold an anonymous session, `updateUser` upgrades that same
 * auth user in place: the id does not change, so the analysis they just ran
 * stays theirs with no data migration and no window where rows are orphaned.
 * Only a visitor with no session at all goes through `signUp`.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  businessName: string,
): Promise<AuthResult> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, errorKey: "weakPassword" };
  }

  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user !== null && user.is_anonymous === true) {
    const { error } = await supabase.auth.updateUser({ email, password });
    if (error !== null) return { ok: false, errorKey: mapAuthError(error.message) };
    await saveBusinessName(businessName);
    return { ok: true };
  }

  const { error } = await supabase.auth.signUp({ email, password });
  if (error !== null) return { ok: false, errorKey: mapAuthError(error.message) };

  await saveBusinessName(businessName);
  return { ok: true };
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  return error === null ? { ok: true } : { ok: false, errorKey: "invalidCredentials" };
}

/** Only available when Google is enabled in the Supabase dashboard. */
export async function signInWithGoogle(redirectTo: string): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  return error === null ? { ok: true } : { ok: false, errorKey: "generic" };
}

export async function signOut(): Promise<void> {
  await getSupabaseBrowserClient().auth.signOut();
}

/**
 * Writes the business name onto the caller's own row. Upserts on `owner_id`
 * so it works whether or not `ensureBusiness` has run yet.
 */
async function saveBusinessName(businessName: string): Promise<void> {
  const trimmed = businessName.trim();
  if (trimmed === "") return;

  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return;

  await supabase
    .from("businesses")
    .upsert({ owner_id: user.id, name: trimmed }, { onConflict: "owner_id" });
}

/**
 * Maps a Supabase error message to one of our Hebrew copy keys.
 *
 * Matching on message text is unavoidable — Supabase does not return stable
 * codes for these — so anything unrecognized falls through to the generic
 * message rather than being shown raw English to the user.
 */
function mapAuthError(message: string): AuthResult["errorKey"] {
  const lower = message.toLowerCase();
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "emailTaken";
  }
  if (lower.includes("password")) return "weakPassword";
  return "generic";
}
