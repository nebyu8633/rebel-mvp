import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { getServerSupabase } from "@/lib/supabase/server";
import { pushServerConfig } from "@/lib/push/config";

export const dynamic = "force-dynamic";

const Sub = z.object({ endpoint: z.string().url().max(2000), keys: z.object({ p256dh: z.string().max(500), auth: z.string().max(200) }) });

/** Store/remove the current browser's push subscription for the signed-in user (RLS-protected). */
export async function POST(req: Request) {
  if (!pushServerConfig().ready) return NextResponse.json({ error: "התראות Push לא הוגדרו בשרת" }, { status: 503 });
  const sb = await getServerSupabase();
  const { data } = (await sb?.auth.getUser()) ?? { data: { user: null } };
  if (!sb || !data.user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });
  const parsed = Sub.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "מנוי לא תקין" }, { status: 400 });
  const id = createHash("sha256").update(parsed.data.endpoint).digest("hex").slice(0, 32);
  const { error } = await sb.from("push_subscriptions").upsert(
    { user_id: data.user.id, id, endpoint: parsed.data.endpoint, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth, updated_at: new Date().toISOString() },
    { onConflict: "user_id,id" },
  );
  if (error) return NextResponse.json({ error: "שמירת המנוי נכשלה" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const sb = await getServerSupabase();
  const { data } = (await sb?.auth.getUser()) ?? { data: { user: null } };
  if (!sb || !data.user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) return NextResponse.json({ error: "חסר endpoint" }, { status: 400 });
  const id = createHash("sha256").update(body.endpoint).digest("hex").slice(0, 32);
  await sb.from("push_subscriptions").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
