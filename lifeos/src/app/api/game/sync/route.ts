import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/ai/http";
import { supabaseEnabled } from "@/lib/supabase/config";
import { adminClient, adminDelete, adminUpsert, loadUserDb } from "@/lib/server/userData";
import { computeEarned, profileOf, reconcile } from "@/lib/game/engine";
import { challengeEvents } from "@/lib/game/ledger";
import { COLLECTIONS } from "@/lib/types";
import { evaluationsToFreeze } from "@/lib/game/difficulty";

export const dynamic = "force-dynamic";

const Body = z.object({ today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

/**
 * Server-side XP ledger (cloud mode). Reads the user's records through RLS, recomputes every award
 * with the same deterministic engine and writes the ledger with the service role. Clients cannot
 * write xp_events at all (RLS), so XP values from a client are never trusted.
 */
export async function POST(req: Request) {
  const g = await guard("sync", 60);
  if (g instanceof NextResponse) return g;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  const admin = adminClient();
  if (!supabaseEnabled || !admin) return NextResponse.json({ error: "חישוב XP בשרת דורש Supabase ו-SUPABASE_SERVICE_ROLE_KEY", code: "not_configured" }, { status: 503 });
  // don't let a client claim a far-away "today" to unlock time-based challenges
  const today = parsed.data.today;
  const serverDay = new Date().toISOString().slice(0, 10);
  if (Math.abs(Date.parse(today) - Date.parse(serverDay)) > 2 * 86_400_000) return NextResponse.json({ error: "תאריך לא תקין" }, { status: 400 });
  const loaded = await loadUserDb(Object.keys(COLLECTIONS) as Array<keyof typeof COLLECTIONS>);
  if (!loaded) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });
  let { db } = loaded;
  const { userId } = loaded;
  const now = new Date().toISOString();
  // completed tasks without an evaluation get one frozen now (edits after completion can't change the reward)
  const frozen = evaluationsToFreeze(db, now);
  if (frozen.length) {
    try {
      await adminUpsert(admin, "evaluations", frozen as unknown as Array<Record<string, unknown>>, userId);
    } catch (e) {
      return NextResponse.json({ error: "שמירת ההערכות נכשלה", detail: e instanceof Error ? e.message : "" }, { status: 500 });
    }
    db = { ...db, evaluations: { ...db.evaluations, ...Object.fromEntries(frozen.map((e) => [e.id, e])) } };
  }
  const earned = [...computeEarned(db, profileOf(db), today), ...challengeEvents(db, today, now)];
  const r = reconcile(db, earned, now);
  try {
    await adminUpsert(admin, "xpEvents", r.put as unknown as Array<Record<string, unknown>>, userId);
    await adminDelete(admin, "xpEvents", r.remove, userId);
  } catch (e) {
    return NextResponse.json({ error: "עדכון ה-XP נכשל", detail: e instanceof Error ? e.message : "" }, { status: 500 });
  }
  return NextResponse.json({ put: r.put, remove: r.remove, gained: r.gained.map((e) => e.id), evaluations: frozen });
}
