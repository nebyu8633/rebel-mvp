import { NextResponse } from "next/server";
import webpush from "web-push";
import { getServerSupabase } from "@/lib/supabase/server";
import { pushServerConfig } from "@/lib/push/config";

export const dynamic = "force-dynamic";

/**
 * Sends one test notification to the signed-in user's own devices, right now. It verifies the
 * delivery path (subscription → push service → service worker → notification) independently of
 * the scheduler. Reports what the push service accepted; whether it was SHOWN only the user can see.
 */
export async function POST() {
  const { cfg, ready } = pushServerConfig();
  if (!ready) return NextResponse.json({ error: "התראות Push לא הוגדרו בשרת" }, { status: 503 });
  const sb = await getServerSupabase();
  const { data } = (await sb?.auth.getUser()) ?? { data: { user: null } };
  if (!sb || !data.user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });
  // RLS: the user reads only their own subscriptions
  const { data: subs, error } = await sb.from("push_subscriptions").select("id,endpoint,p256dh,auth");
  if (error) return NextResponse.json({ error: "קריאת המנויים נכשלה" }, { status: 500 });
  if (!subs?.length) return NextResponse.json({ error: "אין מכשיר רשום. הפעילו קודם התראות במכשיר הזה." }, { status: 404 });
  webpush.setVapidDetails(cfg.vapidSubject, cfg.vapidPublic, cfg.vapidPrivate);
  let accepted = 0;
  const failures: string[] = [];
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: "בדיקת התראה", body: "אם רואים את זה — ההתראות מהשרת מגיעות למכשיר.", tag: `test:${Date.now()}`, href: "/settings" }),
        { TTL: 120 },
      );
      accepted++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      failures.push(code ? String(code) : "network");
      if (code === 404 || code === 410) await sb.from("push_subscriptions").delete().eq("id", s.id);
    }
  }
  return NextResponse.json({ devices: subs.length, accepted, failures });
}
