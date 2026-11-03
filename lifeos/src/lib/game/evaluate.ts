"use client";
/** Client side of task evaluation: asks the server, stores the result where this mode allows. */
import { useStore } from "../store/store";
import { nowIso } from "../actions";
import type { TaskEvaluation } from "../types";
import { assessInputFor, buildEvaluation, contentHash, evaluationFromAssessment, ruleDims, type Assessment } from "./difficulty";
import { aiConfigured } from "../ai/client";

export interface EvalResult {
  evaluation: TaskEvaluation | null;
  ai: boolean;
  error?: string;
}

const inFlight = new Map<string, Promise<EvalResult>>();

/** Evaluate (or re-evaluate) a task. Completed tasks keep their frozen evaluation. */
export function evaluateTask(taskId: string, opts: { clarifiedScope?: string; answers?: TaskEvaluation["answers"] } = {}): Promise<EvalResult> {
  const key = `${taskId}|${opts.clarifiedScope ?? ""}|${(opts.answers ?? []).map((a) => a.a).join("|")}`;
  const running = inFlight.get(key);
  if (running) return running;
  const p = run(taskId, opts).finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

async function run(taskId: string, opts: { clarifiedScope?: string; answers?: TaskEvaluation["answers"] }): Promise<EvalResult> {
  const st = useStore.getState();
  const db = st.db;
  const task = db.tasks[taskId];
  if (!task) return { evaluation: null, ai: false, error: "המשימה לא נמצאה" };
  const prev = db.evaluations[taskId] ?? null;
  if (task.status === "completed" && prev) return { evaluation: prev, ai: prev.source === "ai" };

  if (st.mode === "supabase") {
    // the server loads the task, evaluates and stores; nothing about XP comes from here
    try {
      const res = await fetch("/api/game/evaluate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ taskId, clarifiedScope: opts.clarifiedScope, answers: opts.answers }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.evaluation) return { evaluation: prev, ai: false, error: j.error ?? "ההערכה נכשלה" };
      useStore.getState().setServerRecords("evaluations", [j.evaluation]);
      return { evaluation: j.evaluation, ai: j.evaluation.source === "ai", error: j.aiError ?? undefined };
    } catch {
      return { evaluation: prev, ai: false, error: "אין חיבור לשרת" };
    }
  }

  // local mode: the browser is the only store
  const clarifiedScope = opts.clarifiedScope ?? prev?.clarifiedScope ?? "";
  const answers = [...(prev?.answers ?? []), ...(opts.answers ?? [])].slice(-6);
  const now = nowIso();
  let ev: TaskEvaluation | null = null;
  let error: string | undefined;
  if (await aiConfigured()) {
    try {
      const res = await fetch("/api/game/evaluate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input: assessInputFor(db, task, clarifiedScope, answers) }) });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.assessment) ev = evaluationFromAssessment({ db: useStore.getState().db, task, clarifiedScope, answers, now }, j.assessment as Assessment);
      else error = j.error ?? "הערכת AI נכשלה";
    } catch {
      error = "אין חיבור לשרת";
    }
  }
  if (!ev) {
    const r = ruleDims(db, task);
    ev = buildEvaluation({ db, task, clarifiedScope, answers, now }, { dims: r.dims, estimatedMinutes: r.minutes, steps: r.steps, source: "rules" });
  }
  // the task may have changed while waiting — store only if still the same scope
  const cur = useStore.getState().db.tasks[taskId];
  if (!cur || contentHash(cur, clarifiedScope) !== ev.contentHash) return { evaluation: prev, ai: false, error: "המשימה השתנתה בזמן ההערכה" };
  await useStore.getState().put("evaluations", ev);
  return { evaluation: ev, ai: ev.source === "ai", error };
}

/** True when the task has no evaluation for its current scope. */
export function needsEvaluation(taskId: string): boolean {
  const db = useStore.getState().db;
  const t = db.tasks[taskId];
  if (!t || t.status === "completed" || t.status === "skipped") return false;
  const e = db.evaluations[taskId];
  return !e || e.contentHash !== contentHash(t, e.clarifiedScope);
}

let bgRunning = false;
let bgCount = 0;
/**
 * Background evaluator: open tasks without an up-to-date evaluation (e.g. created by the planner)
 * are evaluated one by one, slowly, so the AI budget isn't exhausted. Max 30 per session.
 */
export async function evaluatePending() {
  if (bgRunning || bgCount >= 30) return;
  bgRunning = true;
  try {
    const ai = await aiConfigured();
    const ids = Object.values(useStore.getState().db.tasks)
      .filter((t) => needsEvaluation(t.id))
      .sort((a, b) => (a.date ?? "9") < (b.date ?? "9") ? -1 : 1)
      .map((t) => t.id);
    for (const id of ids) {
      if (bgCount >= 30) break;
      // without AI, rules evaluations are computed on the fly — nothing needs storing in local mode
      if (!ai && useStore.getState().mode !== "supabase") break;
      if (!needsEvaluation(id)) continue;
      bgCount++;
      await evaluateTask(id);
      await new Promise((r) => setTimeout(r, 6000));
    }
  } finally {
    bgRunning = false;
  }
}
