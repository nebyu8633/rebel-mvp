import { NextResponse } from "next/server";
import { z } from "zod";
import { TaskAssessInput } from "@/lib/ai/provider";
import { getProvider } from "@/lib/ai/anthropic";
import { aiErrorResponse, guard } from "@/lib/ai/http";
import { supabaseEnabled } from "@/lib/supabase/config";
import { adminClient, adminUpsert, loadUserDb } from "@/lib/server/userData";
import { assessInputFor, evaluationFromAssessment, ruleEvaluation, buildEvaluation, ruleDims } from "@/lib/game/difficulty";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Answer = z.object({ q: z.string().trim().max(300), a: z.string().trim().max(500) });
const Body = z.union([
  // cloud mode: the server loads the task itself — nothing about difficulty or XP is taken from the client
  z.object({ taskId: z.string().min(1).max(100), clarifiedScope: z.string().max(1500).optional(), answers: z.array(Answer).max(6).optional() }),
  // local mode: there is no server database; the browser sends only the task description to be rated
  z.object({ input: TaskAssessInput }),
]);

/**
 * AI task evaluation. The AI only rates dimensions; the level and XP are computed by code.
 * Cloud mode: the evaluation is built and STORED here with the service role (users can't write
 * evaluations or XP). Local mode: returns the ratings; the browser (the only store) builds the record.
 */
export async function POST(req: Request) {
  const g = await guard();
  if (g instanceof NextResponse) return g;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "בקשה לא תקינה", code: "bad_request" }, { status: 400 });
  const provider = getProvider();

  if ("input" in parsed.data) {
    if (supabaseEnabled) return NextResponse.json({ error: "במצב ענן ההערכה מתבצעת בשרת", code: "bad_request" }, { status: 400 });
    if (!provider) return NextResponse.json({ error: "AI לא מוגדר — הערכה בסיסית", code: "not_configured" }, { status: 503 });
    try {
      return NextResponse.json({ assessment: await provider.assessTask(parsed.data.input) });
    } catch (e) {
      return aiErrorResponse(e);
    }
  }

  // ── cloud mode ──
  const admin = adminClient();
  if (!supabaseEnabled || !admin) return NextResponse.json({ error: "הערכה בשרת דורשת Supabase ו-SUPABASE_SERVICE_ROLE_KEY", code: "not_configured" }, { status: 503 });
  const loaded = await loadUserDb(["goals", "milestones", "tasks", "occurrences", "evaluations"]);
  if (!loaded) return NextResponse.json({ error: "יש להתחבר", code: "unauthenticated" }, { status: 401 });
  const { db, userId } = loaded;
  const task = db.tasks[parsed.data.taskId];
  if (!task) return NextResponse.json({ error: "המשימה לא נמצאה", code: "not_found" }, { status: 404 });
  const prev = db.evaluations[task.id];
  // a completed task's evaluation is frozen
  if (task.status === "completed" && prev) return NextResponse.json({ evaluation: prev, frozen: true });
  const now = new Date().toISOString();
  const clarifiedScope = parsed.data.clarifiedScope ?? prev?.clarifiedScope ?? "";
  const answers = [...(prev?.answers ?? []), ...(parsed.data.answers ?? [])].slice(-6);
  let evaluation;
  let aiError: string | null = null;
  if (provider) {
    try {
      const a = await provider.assessTask(assessInputFor(db, task, clarifiedScope, answers));
      evaluation = evaluationFromAssessment({ db, task, clarifiedScope, answers, now }, a);
    } catch (e) {
      aiError = e instanceof Error ? e.message : "AI error";
    }
  }
  if (!evaluation) {
    const r = ruleDims(db, task);
    evaluation = provider ? buildEvaluation({ db, task, clarifiedScope, answers, now }, { ...r, estimatedMinutes: r.minutes, source: "rules" }) : ruleEvaluation(db, task, now);
  }
  try {
    await adminUpsert(admin, "evaluations", [evaluation as unknown as Record<string, unknown>], userId);
  } catch (e) {
    return NextResponse.json({ error: "שמירת ההערכה נכשלה", detail: e instanceof Error ? e.message : "" }, { status: 500 });
  }
  return NextResponse.json({ evaluation, aiError });
}
