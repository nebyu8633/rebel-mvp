import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { emptyDB, type CollectionName, type DB } from "../types";
import { TABLES, hydrate } from "../store/repo";
import { fromRow, toRow } from "../store/supabase";
import { getServerSupabase } from "../supabase/server";

/** Service-role client — SERVER ONLY. Used to write records users may not write themselves (XP ledger, evaluations). */
export function adminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Reads the signed-in user's own records through RLS (their session, not the service role). */
export async function loadUserDb(collections: CollectionName[]): Promise<{ db: DB; userId: string } | null> {
  const sb = await getServerSupabase();
  if (!sb) return null;
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return null;
  const raw: Partial<Record<CollectionName, Record<string, unknown>>> = {};
  await Promise.all(
    collections.map(async (c) => {
      const all: Record<string, unknown> = {};
      for (let from = 0; ; from += 1000) {
        const { data, error } = await sb.from(TABLES[c]).select("*").range(from, from + 999);
        if (error) throw new Error(error.message);
        for (const r of data ?? []) {
          const e = fromRow(r);
          all[e.id as string] = e;
        }
        if (!data || data.length < 1000) break;
      }
      raw[c] = all;
    }),
  );
  return { db: { ...emptyDB(), ...hydrate(raw).db }, userId: u.user.id };
}

export async function adminUpsert(admin: SupabaseClient, c: CollectionName, entities: Array<Record<string, unknown>>, userId: string) {
  if (!entities.length) return;
  const { error } = await admin.from(TABLES[c]).upsert(entities.map((e) => toRow(c, e, userId)), { onConflict: "user_id,id" });
  if (error) throw new Error(error.message);
}

export async function adminDelete(admin: SupabaseClient, c: CollectionName, ids: string[], userId: string) {
  if (!ids.length) return;
  const { error } = await admin.from(TABLES[c]).delete().eq("user_id", userId).in("id", ids);
  if (error) throw new Error(error.message);
}
