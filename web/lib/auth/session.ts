import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { BusinessRow } from "@/types/database";

import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The signed-in user, revalidated against Supabase.
 *
 * Always `getUser()`, never `getSession()`: the latter trusts a cookie the
 * client controls, so it must never be what an access decision reads.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** The caller's business, or null when they have no account or no business yet. */
export async function getCurrentBusiness(
  client?: SupabaseClient,
): Promise<BusinessRow | null> {
  const supabase = client ?? (await getSupabaseServerClient());

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return null;

  const { data } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  return (data as BusinessRow | null) ?? null;
}

/**
 * The caller's business, creating it on first use.
 *
 * A business row is what every other table hangs off, so it has to exist
 * before the first analysis — including for an anonymous visitor who has not
 * signed up yet. When they later sign up, Supabase converts that same auth
 * user in place, so this row and everything referencing it carries over
 * untouched.
 */
export async function ensureBusiness(
  client?: SupabaseClient,
): Promise<BusinessRow | null> {
  const supabase = client ?? (await getSupabaseServerClient());

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return null;

  const existing = await getCurrentBusiness(supabase);
  if (existing !== null) return existing;

  const { data, error } = await supabase
    .from("businesses")
    .insert({ owner_id: user.id })
    .select()
    .single();

  if (error !== null) {
    // A concurrent request may have inserted it first; the unique index on
    // owner_id makes that a conflict rather than a duplicate row.
    return getCurrentBusiness(supabase);
  }

  return data as BusinessRow;
}

/** True for a visitor who has an anonymous session but has not signed up. */
export function isAnonymous(user: User | null): boolean {
  return user !== null && user.is_anonymous === true;
}
