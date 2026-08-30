"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublicConfig } from "@/lib/config/env";

let cached: SupabaseClient | null = null;

/**
 * Browser Supabase client.
 *
 * Cached so that repeated calls across components share one client — a second
 * instance would register its own auth listener and the two can disagree about
 * the current session after a token refresh.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (cached) return cached;

  const { url, anonKey } = getSupabasePublicConfig();
  cached = createBrowserClient(url, anonKey);
  return cached;
}
