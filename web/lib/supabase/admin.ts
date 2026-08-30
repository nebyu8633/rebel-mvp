import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServiceRoleKey, getSupabasePublicConfig } from "@/lib/config/env";

/**
 * Service-role Supabase client. BYPASSES Row Level Security.
 *
 * The `server-only` import above makes importing this file from a client
 * component a build error, which is the actual protection — a comment would
 * not be.
 *
 * Only justified where a request must write rows the caller cannot yet see,
 * namely the analysis pipeline writing results before the row exists. Every
 * such call site must filter by `business_id` by hand, because RLS is not
 * doing it here. Prefer `getSupabaseServerClient()` everywhere else.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  const { url } = getSupabasePublicConfig();

  return createClient(url, getServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
