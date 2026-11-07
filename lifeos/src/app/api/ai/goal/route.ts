import { NextResponse } from "next/server";
import { z } from "zod";
import { getProvider } from "@/lib/ai/anthropic";
import { AIError } from "@/lib/ai/provider";
import { aiErrorResponse, guard } from "@/lib/ai/http";
import { GoalPlanInput, GoalTurnInput } from "@/lib/goalplan/ai-schema";
import { validateGoalPlan } from "@/lib/goalplan/validate";
import { sanitizeTurn } from "@/lib/goalplan/ai-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("turn"), input: GoalTurnInput }),
  z.object({ action: z.literal("plan"), input: GoalPlanInput }),
]);

/**
 * Server-side AI for the goal conversation. Model output is validated and sanitised here;
 * nothing is written to the database by this route — the client stores results only after
 * the user acts on them, through the normal authorised data layer.
 */
export async function POST(req: Request) {
  const g = await guard();
  if (g instanceof NextResponse) return g;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "בקשה לא תקינה", code: "bad_request" }, { status: 400 });
  const provider = getProvider();
  if (!provider) return aiErrorResponse(new AIError("not_configured", "לא הוגדר מפתח AI בשרת."));
  try {
    if (parsed.data.action === "turn") {
      const out = await provider.goalTurn(parsed.data.input);
      return NextResponse.json({ turn: sanitizeTurn(out, parsed.data.input) });
    }
    const plan = await provider.goalPlan(parsed.data.input);
    const v = validateGoalPlan(plan, { today: parsed.data.input.today });
    if (!v.ok) return NextResponse.json({ error: `התוכנית מה-AI לא עברה בדיקת תקינות: ${v.errors.join("; ")}`, code: "invalid_output" }, { status: 502 });
    return NextResponse.json({ plan: v.plan, fixes: v.fixes });
  } catch (e) {
    return aiErrorResponse(e);
  }
}
