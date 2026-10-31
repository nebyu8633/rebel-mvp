import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "./config";

/** Server client bound to the current request's auth cookies (never the service role). */
export async function getServerSupabase() {
  if (!supabaseEnabled) return null;
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // called from a Server Component — middleware refreshes the session instead
        }
      },
    },
  });
}

/** Returns the signed-in user, or null. In local mode returns a fixed local identity. */
export async function getRequestUser(): Promise<{ id: string; local: boolean } | null> {
  if (!supabaseEnabled) return { id: "local", local: true };
  const sb = await getServerSupabase();
  const { data, error } = await sb!.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, local: false };
}
