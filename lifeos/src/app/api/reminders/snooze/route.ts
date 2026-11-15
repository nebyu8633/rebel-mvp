import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const Body = z.object({
  id: z.string().min(6).max(80),
  reminderKey: z.string().min(1).max(300),
  instanceKey: z.string().max(120).nullable().optional(),
  title: z.string().trim().min(1).max(300),
  body: z.string().max(500).default(""),
  // in-app path only ("//host" would leave the app when the notification is tapped)
  href: z.string().regex(/^\/(?![/\\])/).max(300).default("/today"),
  minutes: z.number().int().min(1).max(24 * 60),
});

/**
 * Store a snooze on the server (RLS: the user's own rows) so the scheduler delivers it even when
 * the app is closed. 501 = the reliability migration isn't applied: the client keeps its local snooze.
 */
export async function POST(req: Request) {
  const sb = await getServerSupabase();
  const { data } = (await sb?.auth.getUser()) ?? { data: { user: null } };
  if (!sb || !data.user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  const fireAt = new Date(Date.now() + p.data.minutes * 60_000).toISOString();
  const { error } = await sb.from("reminder_snoozes").insert({
    user_id: data.user.id,
    id: p.data.id,
    reminder_key: p.data.reminderKey,
    instance_key: p.data.instanceKey ?? null,
    title: p.data.title,
    body: p.data.body,
    href: p.data.href,
    fire_at: fireAt,
  });
  if (error) {
    const notMigrated = error.code === "42P01" || error.code === "PGRST205";
    return NextResponse.json({ error: notMigrated ? "נודניק בשרת עוד לא הופעל" : "שמירת הנודניק נכשלה" }, { status: notMigrated ? 501 : 500 });
  }
  return NextResponse.json({ ok: true, fireAt });
}
