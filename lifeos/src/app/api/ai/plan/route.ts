import { NextResponse } from "next/server";
import { z } from "zod";
import { PlanInput } from "@/lib/planner/schema";
import { validatePlan } from "@/lib/planner/validate";
import { getProvider } from "@/lib/ai/anthropic";
import { AIError } from "@/lib/ai/provider";
import { aiErrorResponse, guard } from "@/lib/ai/http";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const Body = z.object({ input: PlanInput, today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export async function POST(req: Request) {
  const g = await guard();
  if (g instanceof NextResponse) return g;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "בקשה לא תקינה", code: "bad_request" }, { status: 400 });
  const provider = getProvider();
  if (!provider) return aiErrorResponse(new AIError("not_configured", "לא הוגדר מפתח AI בשרת."));
  try {
    const { input, today } = parsed.data;
    const raw = await provider.plan(input, today);
    const v = validatePlan(raw, { today, targetDate: input.targetDate });
    if (!v.ok) return NextResponse.json({ error: `התוכנית שהתקבלה מה-AI לא עברה בדיקת תקינות: ${v.errors.join("; ")}`, code: "invalid_output" }, { status: 502 });
    return NextResponse.json({ plan: v.plan, fixes: v.fixes, source: provider.name });
  } catch (e) {
    return aiErrorResponse(e);
  }
}
