import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { pushServerConfig } from "@/lib/push/config";
import { planForUser, snoozeDecision, RECOVERY_MINUTES, type Outgoing, type SnoozeRow } from "@/lib/push/due";
import { emptyDB, type CollectionName, type DB } from "@/lib/types";
import { TABLES } from "@/lib/store/repo";
import { fromRow } from "@/lib/store/supabase";
import { hydrate } from "@/lib/store/repo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NEEDED: CollectionName[] = ["settings", "tasks", "occurrences", "reminders", "events", "habits", "habitLogs", "goals", "milestones", "evidence", "xpEvents", "gameProfile"];
type Sub = { id: string; endpoint: string; p256dh: string; auth: string };
/** Postgres "undefined column/table" — the reliability migration isn't applied yet; degrade gracefully. */
const missing = (e: { code?: string } | null) => !!e && (e.code === "42703" || e.code === "42P01" || e.code === "PGRST204" || e.code === "PGRST205");

/**
 * Background reminder scheduler. Called every minute by Supabase pg_cron (see
 * supabase/scheduler/reminders_cron.sql) or any cron, with `Authorization: Bearer $CRON_SECRET`.
 * Uses the service-role key SERVER-SIDE ONLY. Every message is CLAIMED in push_deliveries before
 * sending (primary key → never twice, even with overlapping runs), then its real outcome is recorded.
 */
export async function GET(req: Request) {
  const { cfg, ready, missing: miss } = pushServerConfig();
  if (!ready) return NextResponse.json({ error: "push not configured", missing: miss }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${cfg.cronSecret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  webpush.setVapidDetails(cfg.vapidSubject, cfg.vapidPublic, cfg.vapidPrivate);
  const admin = createClient(cfg.supabaseUrl, cfg.serviceRoleKey, { auth: { persistSession: false } });
  const { data: subs, error } = await admin.from("push_subscriptions").select("user_id,id,endpoint,p256dh,auth");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byUser = new Map<string, Sub[]>();
  for (const s of subs ?? []) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);
  const now = new Date();
  const stats = { users: byUser.size, messages: 0, delivered: 0, failed: 0, late: 0, snoozes: 0, statusTracking: true };

  for (const [userId, userSubs] of byUser) {
    const db = await loadUser(admin, userId);
    const since = new Date(now.getTime() - (RECOVERY_MINUTES + 24 * 60) * 60_000).toISOString();
    const { data: delivered } = await admin.from("push_deliveries").select("reminder_key").eq("user_id", userId).gte("sent_at", since);
    const sent = new Set((delivered ?? []).map((d) => d.reminder_key as string));

    const outgoing: Outgoing[] = planForUser(db, now, sent);
    // server-side snoozes (table exists only after the reliability migration)
    const { data: snz, error: snzErr } = await admin.from("reminder_snoozes").select("id,reminder_key,instance_key,title,body,href,fire_at").eq("user_id", userId).lte("fire_at", now.toISOString());
    if (!missing(snzErr))
      for (const s of (snz ?? []) as SnoozeRow[]) {
        const d = snoozeDecision(db, s, now);
        if (d === "send" && !sent.has(`snz:${s.id}`)) outgoing.push({ keys: [`snz:${s.id}`], title: s.title, body: s.body || "תזכורת שנדחתה", href: s.href, tag: s.reminder_key, late: false });
        if (d !== "wait") await admin.from("reminder_snoozes").delete().eq("user_id", userId).eq("id", s.id);
        if (d === "send") stats.snoozes++;
      }

    for (const msg of outgoing) {
      // claim every key first; if any is already claimed (parallel run), skip the message
      const { error: claimErr } = await admin.from("push_deliveries").insert(msg.keys.map((k) => ({ user_id: userId, reminder_key: k })));
      if (claimErr) continue;
      stats.messages++;
      if (msg.late) stats.late++;
      let ok = 0;
      const errors: string[] = [];
      for (const s of userSubs) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: msg.title, body: msg.body, tag: msg.tag, href: msg.href }), { TTL: msg.late ? 3600 : 900, urgency: "high" });
          ok++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          errors.push(code ? `push ${code}` : "network");
          // the device unsubscribed / the app was removed: forget this subscription
          if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("user_id", userId).eq("id", s.id);
        }
      }
      stats.delivered += ok;
      stats.failed += userSubs.length - ok;
      // "sent" = the push service ACCEPTED it; whether the phone displayed it is not knowable here
      const status = ok === userSubs.length ? "sent" : ok > 0 ? "partial" : "failed";
      const { error: upErr } = await admin
        .from("push_deliveries")
        .update({ status, error: errors.join(", ") || null, devices: userSubs.length, delivered: ok, late: msg.late })
        .eq("user_id", userId)
        .in("reminder_key", msg.keys);
      if (missing(upErr)) stats.statusTracking = false;
    }
  }
  return NextResponse.json({ ok: true, at: now.toISOString(), ...stats });
}

async function loadUser(admin: SupabaseClient, userId: string): Promise<DB> {
  const raw: Partial<Record<CollectionName, Record<string, unknown>>> = {};
  for (const c of NEEDED) {
    const { data } = await admin.from(TABLES[c]).select("*").eq("user_id", userId).limit(5000);
    raw[c] = Object.fromEntries(
      (data ?? []).map((r) => {
        const e = fromRow(r);
        return [e.id as string, e];
      }),
    );
  }
  return { ...emptyDB(), ...hydrate(raw).db };
}
