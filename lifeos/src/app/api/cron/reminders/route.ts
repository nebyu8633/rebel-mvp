import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { pushServerConfig } from "@/lib/push/config";
import { dueForUser } from "@/lib/push/due";
import { emptyDB, type CollectionName } from "@/lib/types";
import { TABLES } from "@/lib/store/repo";
import { fromRow } from "@/lib/store/supabase";
import { hydrate } from "@/lib/store/repo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NEEDED: CollectionName[] = ["settings", "tasks", "occurrences", "reminders", "events", "habits", "habitLogs"];

/**
 * Background reminder scheduler. Call it every few minutes from a scheduler
 * (Vercel Cron on a plan that allows it, or any external cron) with
 * `Authorization: Bearer $CRON_SECRET`. Uses the service-role key SERVER-SIDE ONLY,
 * reads each subscribed user's reminders, and records deliveries so nothing is sent twice.
 */
export async function GET(req: Request) {
  const { cfg, ready, missing } = pushServerConfig();
  if (!ready) return NextResponse.json({ error: "push not configured", missing }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${cfg.cronSecret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  webpush.setVapidDetails(cfg.vapidSubject, cfg.vapidPublic, cfg.vapidPrivate);
  const admin = createClient(cfg.supabaseUrl, cfg.serviceRoleKey, { auth: { persistSession: false } });
  const { data: subs, error } = await admin.from("push_subscriptions").select("user_id,id,endpoint,p256dh,auth");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byUser = new Map<string, typeof subs>();
  for (const s of subs ?? []) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);
  let sent = 0;
  const now = new Date();
  for (const [userId, userSubs] of byUser) {
    const raw: Partial<Record<CollectionName, Record<string, unknown>>> = {};
    for (const c of NEEDED) {
      const { data } = await admin.from(TABLES[c]).select("*").eq("user_id", userId).limit(5000);
      raw[c] = Object.fromEntries((data ?? []).map((r) => {
        const e = fromRow(r);
        return [e.id as string, e];
      }));
    }
    const db = { ...emptyDB(), ...hydrate(raw).db };
    const since = new Date(now.getTime() - 36 * 3600_000).toISOString();
    const { data: delivered } = await admin.from("push_deliveries").select("reminder_key").eq("user_id", userId).gte("sent_at", since);
    const due = dueForUser(db, now, new Set((delivered ?? []).map((d) => d.reminder_key)));
    for (const r of due) {
      // claim first (primary key prevents a parallel run from sending the same reminder)
      const { error: claimErr } = await admin.from("push_deliveries").insert({ user_id: userId, reminder_key: r.key });
      if (claimErr) continue;
      for (const s of userSubs) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: r.title, body: r.body, tag: r.key, href: r.href }), { TTL: 600 });
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("user_id", userId).eq("id", s.id);
        }
      }
    }
  }
  return NextResponse.json({ ok: true, users: byUser.size, sent });
}
