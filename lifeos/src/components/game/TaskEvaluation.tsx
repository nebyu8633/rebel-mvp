"use client";
import { useEffect, useState } from "react";
import { Loader2, Sparkles, RefreshCw, Info } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { evaluateTask, needsEvaluation } from "@/lib/game/evaluate";
import { DIM_LABEL, LEVEL_LABEL, WEIGHTS, XP_TABLE, effectiveEvaluation, RULES_MAX_LEVEL } from "@/lib/game/difficulty";
import { formatDuration } from "@/lib/dates";
import { Button, Details, Textarea, cx } from "@/components/ui";
import type { EvalDims } from "@/lib/types";

export function DifficultyPips({ level, className }: { level: number; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-0.5", className)} aria-label={`קושי ${level} מתוך 5`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={cx("h-2 w-2 rotate-45 rounded-[2px]", i <= level ? "bg-amber-500" : "bg-stone-300 dark:bg-stone-600")} />
      ))}
    </span>
  );
}

const FAM_LABEL = { new: "חדש לך", some: "עשית דומה", experienced: "מנוסה בזה" } as const;

/** Evaluation card: difficulty, duration, XP, why — plus clarification questions and a scope correction. */
export function TaskEvaluationView({ taskId, autoRun, onDone }: { taskId: string; autoRun?: boolean; onDone?: () => void }) {
  const db = useStore((s) => s.db);
  const task = db.tasks[taskId];
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [scopeOpen, setScopeOpen] = useState(false);
  const stored = db.evaluations[taskId];
  const [scope, setScope] = useState(stored?.clarifiedScope ?? "");

  const run = async (opts: Parameters<typeof evaluateTask>[1] = {}) => {
    setBusy(true);
    setNote(null);
    const r = await evaluateTask(taskId, opts);
    setBusy(false);
    setAnswers({});
    if (r.error) setNote(r.ai ? r.error : `${r.error} — הוצגה הערכה בסיסית.`);
  };
  useEffect(() => {
    if (autoRun && needsEvaluation(taskId)) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, taskId]);

  if (!task) return null;
  const { ev, stale } = effectiveEvaluation(db, task);
  const frozen = task.status === "completed";
  const questions = stored && !stale ? stored.questions : [];
  const [lo, hi] = XP_TABLE[ev.difficulty as 1 | 2 | 3 | 4 | 5];

  return (
    <div className="space-y-3" data-testid="task-evaluation">
      {busy && !stored ? (
        <div className="flex items-center gap-2 py-6 text-sm text-stone-500">
          <Loader2 size={16} className="animate-spin" /> מעריך את היקף המשימה…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-stone-50 p-3 dark:bg-white/5">
              <div className="text-[11px] text-stone-500">קושי</div>
              <div className="mt-1 text-lg font-bold" data-testid="eval-level">
                {ev.difficulty}/5
              </div>
              <DifficultyPips level={ev.difficulty} />
              <div className="mt-0.5 text-[11px] text-stone-500">{LEVEL_LABEL[ev.difficulty]}</div>
            </div>
            <div className="rounded-2xl bg-stone-50 p-3 dark:bg-white/5">
              <div className="text-[11px] text-stone-500">משך משוער</div>
              <div className="mt-1 text-lg font-bold">{formatDuration(ev.estimatedMinutes) || `${ev.estimatedMinutes} דק׳`}</div>
              {ev.personalMinutes && ev.personalMinutes !== ev.estimatedMinutes && <div className="text-[11px] text-stone-500">בקצב שלך: {formatDuration(ev.personalMinutes)}</div>}
              <div className="text-[11px] text-stone-500">{FAM_LABEL[ev.familiarity]}</div>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3 dark:bg-amber-400/10">
              <div className="text-[11px] text-stone-500">פרס</div>
              <div className="mt-1 text-lg font-bold text-amber-700 dark:text-amber-300 ltr-nums" data-testid="eval-xp">
                {ev.xp} XP
              </div>
              <div className="text-[11px] text-stone-500 ltr-nums">
                טווח הרמה {lo}–{hi}
              </div>
            </div>
          </div>

          <p className="text-sm text-stone-700 dark:text-stone-200" data-testid="eval-explanation">
            {busy && <Loader2 size={14} className="me-1 inline animate-spin" />}
            {ev.explanation}
          </p>
          {ev.reasons.length > 0 && (
            <ul className="space-y-0.5 text-xs text-stone-500">
              {ev.reasons.map((r) => (
                <li key={r}>• {r}</li>
              ))}
            </ul>
          )}
          {stale && !busy && <p className="text-xs text-amber-700 dark:text-amber-300">ההיקף השתנה — ה-XP הנמוך מבין ההערכות נשמר עד להערכה מחדש.</p>}
          {note && <p className="text-xs text-stone-500">{note}</p>}
          {ev.source === "rules" && !busy && <p className="text-xs text-stone-500">הערכה בסיסית (בלי AI) מוגבלת לרמה {RULES_MAX_LEVEL}.</p>}

          {!frozen && questions.length > 0 && (
            <div className="space-y-2.5 rounded-2xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-400/20 dark:bg-amber-400/5" data-testid="eval-questions">
              <div className="text-xs font-semibold text-amber-800 dark:text-amber-200">כדי להעריך נכון:</div>
              {questions.map((q, i) => (
                <div key={q.q}>
                  <div className="text-sm">{q.q}</div>
                  {q.options.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {q.options.map((o) => (
                        <button key={o} type="button" onClick={() => setAnswers((a) => ({ ...a, [i]: o }))} className={cx("rounded-full border px-2.5 py-1 text-xs", answers[i] === o ? "border-amber-500 bg-amber-500 text-white" : "border-stone-300 bg-white dark:border-white/15 dark:bg-transparent")}>
                          {o}
                        </button>
                      ))}
                    </div>
                  )}
                  <input value={answers[i] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))} placeholder="תשובה קצרה" maxLength={300} className="mt-1.5 w-full rounded-xl border hairline bg-white px-3 py-1.5 text-sm dark:bg-transparent" />
                </div>
              ))}
              <Button size="sm" variant="primary" disabled={busy || !Object.values(answers).some((a) => a.trim())} onClick={() => void run({ answers: questions.map((q, i) => ({ q: q.q, a: (answers[i] ?? "").trim() })).filter((x) => x.a) })} data-testid="eval-answer">
                עדכון ההערכה
              </Button>
            </div>
          )}

          <Details label="איך חושב">
            <div className="space-y-1.5">
              {(Object.keys(WEIGHTS) as Array<keyof EvalDims>).map((k) => (
                <div key={k} className="flex items-center gap-2 text-xs">
                  <span className="w-24 shrink-0">{DIM_LABEL[k]}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200 dark:bg-white/10">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${(ev.dims[k] / 5) * 100}%` }} />
                  </div>
                  <span className="w-20 shrink-0 text-stone-500 ltr-nums">
                    {ev.dims[k].toFixed(1)} · {Math.round(WEIGHTS[k] * 100)}%
                  </span>
                </div>
              ))}
              <p className="pt-1 text-[11px] text-stone-500">
                ציון משוקלל {ev.score} → רמה {ev.difficulty}. הקשר למטרה משפיע מעט מאוד (עד ±0.15), כדי שמשימה קטנה לא תהפוך לקשה רק כי המטרה חשובה. ה-XP נקבע לפי הרמה — אי אפשר לבחור אותו, אפשר רק להבהיר את ההיקף. ניסיון מקצר את משך הזמן המשוער שלך, אבל לא מוריד XP.
              </p>
            </div>
          </Details>

          {!frozen && (
            <div>
              {scopeOpen ? (
                <div className="space-y-2">
                  <Textarea value={scope} onChange={(e) => setScope(e.target.value.slice(0, 1500))} placeholder="מה בדיוק כולל העבודה? למשל: 3 פרקים, 20 עמודים, כולל סיכום" rows={3} />
                  <div className="flex gap-2">
                    <Button size="sm" variant="primary" disabled={busy} onClick={() => void run({ clarifiedScope: scope.trim() }).then(() => setScopeOpen(false))} data-testid="eval-scope-save">
                      הערכה מחדש
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setScopeOpen(false)}>
                      ביטול
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setScopeOpen(true)}>
                    <Info size={14} /> תיקון היקף המשימה
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run()}>
                    <RefreshCw size={14} /> הערכה מחדש
                  </Button>
                </div>
              )}
            </div>
          )}
          {frozen && <p className="text-xs text-stone-500">המשימה הושלמה — ההערכה נעולה.</p>}
          {onDone && (
            <div className="flex justify-end">
              <Button variant="primary" onClick={onDone} data-testid="eval-done">
                <Sparkles size={15} /> סיום
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** One-line summary for lists/editor. */
export function EvaluationSummary({ taskId }: { taskId: string }) {
  const db = useStore((s) => s.db);
  const t = db.tasks[taskId];
  if (!t) return null;
  const { ev } = effectiveEvaluation(db, t);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
      <DifficultyPips level={ev.difficulty} /> <span className="ltr-nums">{ev.xp} XP</span>
    </span>
  );
}
