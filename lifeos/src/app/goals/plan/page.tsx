"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, RefreshCw, Check, AlertTriangle, Info, User, Lightbulb, BookOpen, ArrowRight } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useToday } from "@/hooks/useToday";
import { PlanInput, type PlanProposal, type PlanTask } from "@/lib/planner/schema";
import { fallbackPlan, PlanInputError } from "@/lib/planner/fallback";
import { validatePlan } from "@/lib/planner/validate";
import { aiConfigured, requestAIPlan, AIRequestError } from "@/lib/ai/client";
import { approvePlan } from "@/lib/actions";
import { blankGoal } from "@/components/GoalForms";
import { summarizeAccount } from "@/lib/finance";
import { latestWeight } from "@/lib/goals";
import { addMonths, formatHebDate } from "@/lib/dates";
import { Badge, Button, Card, Field, Input, PageHeader, SectionTitle, Select, Spinner, Textarea, confirmDialog, cx } from "@/components/ui";
import { PRIORITY_LABELS } from "@/components/TaskEditor";
import type { Goal, MotorcycleInfo } from "@/lib/types";

export default function PlannerPage() {
  return (
    <Suspense>
      <Planner />
    </Suspense>
  );
}

type Engine = "ai" | "basic";

function Planner() {
  const params = useSearchParams();
  const router = useRouter();
  const db = useStore((s) => s.db);
  const today = useToday();
  const [goalId, setGoalId] = useState(params.get("goal") ?? "");
  const goal: Goal | null = goalId ? db.goals[goalId] ?? null : null;
  const [ai, setAi] = useState<boolean | null>(null);
  const [engine, setEngine] = useState<Engine>("basic");
  const [form, setForm] = useState(() => initialForm(goal, today));
  const [hoursPerWeek, setHoursPerWeek] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ msg: string; canFallback: boolean } | null>(null);
  const [plan, setPlan] = useState<PlanProposal | null>(null);
  const [planSource, setPlanSource] = useState<Engine>("basic");
  const [fixes, setFixes] = useState<string[]>([]);
  const [approvedMs, setApprovedMs] = useState<Set<string>>(new Set());
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const [habits, setHabits] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<{ warnings: string[]; created: number; goalId: string } | null>(null);

  useEffect(() => {
    aiConfigured().then((c) => {
      setAi(c);
      setEngine(c ? "ai" : "basic");
    });
  }, []);

  useEffect(() => {
    setForm(initialForm(goal, today, db));
    setPlan(null);
    setResult(null);
  }, [goalId]); // eslint-disable-line react-hooks/exhaustive-deps

  const input = useMemo(() => {
    const wm = hoursPerWeek.trim() === "" ? null : Math.round(Number(hoursPerWeek) * 60);
    return { ...form, goalId: goal?.id ?? null, weeklyMinutes: Number.isFinite(wm) ? wm : null };
  }, [form, goal, hoursPerWeek]);

  async function generate(regenerateKey?: string) {
    setError(null);
    const parsed = PlanInput.safeParse({ ...input, regenerateMilestoneKey: regenerateKey ?? null, previous: regenerateKey ? plan : null });
    if (!parsed.success) return setError({ msg: parsed.error.issues[0]?.message ?? "פרטים חסרים", canFallback: false });
    if (parsed.data.targetDate <= today) return setError({ msg: "תאריך היעד חייב להיות בעתיד", canFallback: false });
    setBusy(true);
    try {
      let proposal: PlanProposal;
      let src: Engine = engine;
      let fx: string[] = [];
      if (engine === "ai") {
        const r = await requestAIPlan(parsed.data, today);
        proposal = r.plan;
        fx = r.fixes;
      } else {
        proposal = fallbackPlan(parsed.data, today);
        src = "basic";
      }
      const v = validatePlan(proposal, { today, targetDate: parsed.data.targetDate });
      if (!v.ok || !v.plan) throw new Error(v.errors.join("; "));
      setPlan(v.plan);
      setPlanSource(src);
      setFixes([...fx, ...v.fixes]);
      if (!regenerateKey) {
        setApprovedMs(new Set(v.plan.milestones.map((m) => m.key)));
        setRejected(new Set());
        setHabits(new Set(v.plan.habits.map((_, i) => i)));
      } else setApprovedMs((s) => new Set([...s, regenerateKey]));
    } catch (e) {
      if (e instanceof PlanInputError) setError({ msg: e.message, canFallback: false });
      else if (e instanceof AIRequestError) setError({ msg: `תכנון ה-AI נכשל: ${e.message}`, canFallback: true });
      else setError({ msg: e instanceof Error ? e.message : "שגיאה", canFallback: engine === "ai" });
    } finally {
      setBusy(false);
    }
  }

  function editTask(mKey: string, tKey: string, patch: Partial<PlanTask>) {
    setPlan((p) =>
      p && {
        ...p,
        milestones: p.milestones.map((m) => (m.key !== mKey ? m : { ...m, tasks: m.tasks.map((t) => (t.key === tKey ? { ...t, ...patch } : t)) })),
      },
    );
  }

  async function approve() {
    if (!plan) return;
    setBusy(true);
    try {
      let target = goal;
      if (!target) {
        target = { ...blankGoal(today), title: form.title.trim(), description: form.description, startDate: form.startDate, targetDate: form.targetDate, status: "planning" };
        if (!(await useStore.getState().put("goals", target))) return;
      }
      const totalTasks = plan.milestones.filter((m) => approvedMs.has(m.key)).flatMap((m) => m.tasks).filter((t) => !rejected.has(t.key)).length;
      if (totalTasks > 25 && !(await confirmDialog({ title: "תוכנית גדולה", message: `יתווספו ${totalTasks} משימות ללוח. להמשיך?`, confirmLabel: "המשך" }))) return;
      const r = await approvePlan({ goal: target, plan, milestoneKeys: [...approvedMs], rejectedTaskKeys: [...rejected], habitIndexes: [...habits], today });
      if (r.ok) setResult({ warnings: r.warnings, created: r.created, goalId: target.id });
    } finally {
      setBusy(false);
    }
  }

  if (result)
    return (
      <div className="mx-auto max-w-xl">
        <Card className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent-600 text-white">
            <Check />
          </div>
          <h1 className="text-xl font-bold">התוכנית נשמרה</h1>
          <p className="mt-1 text-sm text-stone-500">{result.created} משימות שובצו לפי הזמן הפנוי ותאריכי היעד.</p>
          {result.warnings.length > 0 && (
            <ul className="mt-4 space-y-1 rounded-xl bg-amber-50 p-3 text-start text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
              {result.warnings.map((w) => (
                <li key={w}>⚠ {w}</li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="primary" onClick={() => router.push(`/goals/${result.goalId}`)}>
              למטרה
            </Button>
            <Button onClick={() => router.push("/calendar")}>ללוח השנה</Button>
          </div>
        </Card>
      </div>
    );

  const kind = goal?.kind ?? "custom";

  return (
    <div className="space-y-5">
      <Link href={goal ? `/goals/${goal.id}` : "/goals"} className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
        <ArrowRight size={14} /> חזרה
      </Link>
      <PageHeader title="מתכנן מטרות" subtitle="מטרה שנתית ← אבני דרך ← יעדים חודשיים ושבועיים ← משימות. שום דבר לא נכנס ללוח לפני אישור." />

      {!plan && (
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="מטרה">
              <Select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
                <option value="">מטרה חדשה</option>
                {Object.values(db.goals).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </Select>
            </Field>
            {!goal && (
              <Field label="תיאור המטרה">
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="למשל: לסיים קורס פייתון" />
              </Field>
            )}
            <Field label="תאריך התחלה">
              <Input type="date" value={form.startDate} onChange={(e) => e.target.value && setForm({ ...form, startDate: e.target.value })} />
            </Field>
            <Field label="תאריך יעד">
              <Input type="date" value={form.targetDate} onChange={(e) => e.target.value && setForm({ ...form, targetDate: e.target.value })} />
            </Field>
            <Field label="מצב נוכחי" hint="מה כבר קיים / איפה זה עומד היום">
              <Textarea value={form.currentState} onChange={(e) => setForm({ ...form, currentState: e.target.value })} />
            </Field>
            <Field label="תוצאה רצויה">
              <Textarea value={form.desiredOutcome} onChange={(e) => setForm({ ...form, desiredOutcome: e.target.value })} />
            </Field>
            <Field label="שעות בשבוע למטרה הזו" hint="לבדיקה שהתוכנית לא עמוסה מדי">
              <Input inputMode="decimal" value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)} placeholder="למשל 3" />
            </Field>
            <Field label="אילוצים (כסף, זמן, בריאות…)">
              <Input value={form.constraints} onChange={(e) => setForm({ ...form, constraints: e.target.value })} />
            </Field>
            <Field label="התחייבויות קבועות" className="sm:col-span-2">
              <Input value={form.commitments} onChange={(e) => setForm({ ...form, commitments: e.target.value })} placeholder="עבודה א׳-ה׳ 9-17, אימון בשני…" />
            </Field>
          </div>

          <KindData kind={kind} data={form.data} onChange={(data) => setForm({ ...form, data })} />

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Select className="w-auto" value={engine} onChange={(e) => setEngine(e.target.value as Engine)} aria-label="מנוע תכנון">
              <option value="ai" disabled={!ai}>
                AI (Claude){ai === false ? " — לא מוגדר" : ""}
              </option>
              <option value="basic">מנוע בסיסי (ללא AI)</option>
            </Select>
            <Button variant="primary" onClick={() => generate()} disabled={busy}>
              {busy ? <Spinner /> : <Sparkles size={16} />} הצעת תוכנית
            </Button>
          </div>
          {ai === false && <p className="mt-2 text-xs text-stone-500">לא הוגדר מפתח AI בשרת — המנוע הבסיסי בונה תבנית שקופה מהנתונים שהזנת.</p>}
          {error && (
            <div role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-900/20 dark:text-rose-200">
              {error.msg}
              {error.canFallback && (
                <Button
                  size="sm"
                  className="ms-2"
                  onClick={() => {
                    setEngine("basic");
                    setError(null);
                  }}
                >
                  לעבור למנוע הבסיסי
                </Button>
              )}
            </div>
          )}
        </Card>
      )}

      {plan && (
        <>
          <Card>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone={planSource === "ai" ? "indigo" : "stone"}>{planSource === "ai" ? "הוצע ע״י AI" : "מנוע בסיסי (ללא AI)"}</Badge>
              <span className="text-xs text-stone-500">לבדיקה ועריכה לפני אישור</span>
            </div>
            <p className="font-medium">{plan.summary}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Facts icon={<User size={14} />} title="מה שסיפרת" items={plan.userProvided} />
              <Facts icon={<BookOpen size={14} />} title="עובדות כלליות" items={plan.facts} />
              <Facts icon={<Info size={14} />} title="הנחות (לא ידוע בוודאות)" items={plan.assumptions} tone="amber" />
              <Facts icon={<Lightbulb size={14} />} title="המלצות" items={plan.recommendations} />
            </div>
            {plan.warnings.length > 0 && (
              <div className="mt-3 space-y-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                {plan.warnings.map((w) => (
                  <p key={w} className="flex gap-1.5">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {w}
                  </p>
                ))}
              </div>
            )}
            {fixes.length > 0 && (
              <details className="mt-2 text-xs text-stone-500">
                <summary className="cursor-pointer">{fixes.length} תיקונים אוטומטיים בבדיקת תקינות</summary>
                <ul className="mt-1 list-disc ps-5">
                  {fixes.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </details>
            )}
          </Card>

          {plan.milestones.map((m, idx) => {
            const on = approvedMs.has(m.key);
            return (
              <Card key={m.key} className={cx(!on && "opacity-60")}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1.5 h-4 w-4 accent-accent-600"
                      checked={on}
                      onChange={(e) => {
                        const n = new Set(approvedMs);
                        if (e.target.checked) n.add(m.key);
                        else n.delete(m.key);
                        setApprovedMs(n);
                      }}
                    />
                    <span>
                      <span className="block font-semibold">
                        {idx + 1}. {m.title}
                      </span>
                      <span className="text-xs text-stone-500">
                        עד {formatHebDate(m.targetDate, { year: true })}
                        {m.description ? ` · ${m.description}` : ""}
                      </span>
                    </span>
                  </label>
                  <Button size="sm" variant="ghost" onClick={() => generate(m.key)} disabled={busy}>
                    <RefreshCw size={14} /> הצעה מחדש
                  </Button>
                </div>
                {(m.monthlyObjectives.length > 0 || m.weeklyObjectives.length > 0) && (
                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    {m.monthlyObjectives.length > 0 && (
                      <div className="rounded-xl bg-stone-50 p-2.5 dark:bg-white/[0.03]">
                        <div className="mb-1 font-semibold text-stone-500">יעדים חודשיים</div>
                        {m.monthlyObjectives.map((o) => (
                          <div key={o.month + o.title}>• {o.title}</div>
                        ))}
                      </div>
                    )}
                    {m.weeklyObjectives.length > 0 && (
                      <div className="rounded-xl bg-stone-50 p-2.5 dark:bg-white/[0.03]">
                        <div className="mb-1 font-semibold text-stone-500">יעדים שבועיים</div>
                        {m.weeklyObjectives.map((o) => (
                          <div key={o.weekStart + o.title}>
                            • {formatHebDate(o.weekStart)}: {o.title}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <ul className="mt-3 divide-y hairline">
                  {m.tasks.map((t) => {
                    const rej = rejected.has(t.key);
                    return (
                      <li key={t.key} className={cx("py-2.5", rej && "opacity-50")}>
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            aria-label={`לכלול: ${t.title}`}
                            className="mt-2.5 h-4 w-4 accent-accent-600"
                            checked={!rej}
                            disabled={!on}
                            onChange={(e) => {
                              const n = new Set(rejected);
                              if (e.target.checked) n.delete(t.key);
                              else n.add(t.key);
                              setRejected(n);
                            }}
                          />
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <Input value={t.title} onChange={(e) => editTask(m.key, t.key, { title: e.target.value })} disabled={!on || rej} aria-label="כותרת משימה" />
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <Input
                                type="number"
                                min={5}
                                max={480}
                                className="w-20 py-1 text-xs"
                                value={t.durationMinutes}
                                aria-label="משך בדקות"
                                onChange={(e) => editTask(m.key, t.key, { durationMinutes: Number(e.target.value) || 15 })}
                              />
                              <span className="text-stone-500">דק׳</span>
                              <Input type="date" className="w-auto py-1 text-xs" value={t.deadline} aria-label="דדליין" onChange={(e) => e.target.value && editTask(m.key, t.key, { deadline: e.target.value })} />
                              <Select className="w-auto py-1 text-xs" value={t.priority} aria-label="עדיפות" onChange={(e) => editTask(m.key, t.key, { priority: e.target.value as PlanTask["priority"] })}>
                                {(["high", "medium", "low"] as const).map((p) => (
                                  <option key={p} value={p}>
                                    {PRIORITY_LABELS[p]}
                                  </option>
                                ))}
                              </Select>
                              {t.dependsOn.length > 0 && (
                                <Badge tone="amber">
                                  אחרי: {t.dependsOn.map((d) => plan.milestones.flatMap((x) => x.tasks).find((x) => x.key === d)?.title ?? d).join(", ")}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-stone-500">{t.rationale}</p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}

          {plan.habits.length > 0 && (
            <Card>
              <SectionTitle hint="יתווספו לעמוד ההרגלים">הרגלים מוצעים</SectionTitle>
              {plan.habits.map((h, i) => (
                <label key={i} className="flex items-start gap-2 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-accent-600"
                    checked={habits.has(i)}
                    onChange={(e) => {
                      const n = new Set(habits);
                      if (e.target.checked) n.add(i);
                      else n.delete(i);
                      setHabits(n);
                    }}
                  />
                  <span>
                    <b>{h.title}</b> — {h.timesPerWeek} פעמים בשבוע. <span className="text-stone-500">{h.rationale}</span>
                  </span>
                </label>
              ))}
            </Card>
          )}

          <div className="surface sticky bottom-20 z-20 flex flex-wrap items-center gap-2 rounded-2xl border p-3 shadow-lg lg:bottom-4">
            <span className="me-auto text-sm text-stone-600 dark:text-stone-300">
              {approvedMs.size}/{plan.milestones.length} אבני דרך ·{" "}
              {plan.milestones.filter((m) => approvedMs.has(m.key)).flatMap((m) => m.tasks).filter((t) => !rejected.has(t.key)).length} משימות
            </span>
            <Button variant="ghost" onClick={() => setPlan(null)}>
              חזרה לטופס
            </Button>
            <Button onClick={() => setApprovedMs(new Set(plan.milestones.map((m) => m.key)))}>בחירת הכול</Button>
            <Button variant="primary" onClick={approve} disabled={busy || approvedMs.size === 0}>
              {busy ? <Spinner /> : <Check size={16} />} אישור ושיבוץ
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Facts({ icon, title, items, tone }: { icon: React.ReactNode; title: string; items: string[]; tone?: "amber" }) {
  if (!items.length) return null;
  return (
    <div className={cx("rounded-xl p-3 text-sm", tone === "amber" ? "bg-amber-50/70 dark:bg-amber-900/10" : "bg-stone-50 dark:bg-white/[0.03]")}>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-stone-500">
        {icon}
        {title}
      </div>
      <ul className="space-y-0.5">
        {items.map((x, i) => (
          <li key={i}>• {x}</li>
        ))}
      </ul>
    </div>
  );
}

type FormData = Record<string, number | string | null>;

function KindData({ kind, data, onChange }: { kind: Goal["kind"]; data: FormData; onChange: (d: FormData) => void }) {
  const num = (k: string, label: string) => (
    <Field label={label} key={k}>
      <Input inputMode="decimal" value={data[k] ?? ""} onChange={(e) => onChange({ ...data, [k]: e.target.value.trim() === "" ? null : Number(e.target.value.replace(/[,₪\s]/g, "")) })} placeholder="—" />
    </Field>
  );
  if (kind === "custom") return null;
  return (
    <div className="mt-5 rounded-2xl bg-stone-50 p-3 dark:bg-white/[0.03]">
      <p className="mb-3 text-xs text-stone-500">נתונים שהזנת (נטען מהמטרה). רק מה שמופיע כאן ישמש לתכנון — שום דבר לא ימולא בהשערה.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {kind === "motorcycle" && (
          <>
            <Field label="דגם">
              <Input value={String(data.model ?? "")} onChange={(e) => onChange({ ...data, model: e.target.value })} />
            </Field>
            {num("price", "מחיר (₪)")}
            {num("savedSoFar", "חיסכון קיים (₪)")}
            {num("monthlySavingCapacity", "חיסכון חודשי אפשרי (₪)")}
            {num("licenseCost", "רישיון (₪)")}
            {num("gearCost", "ציוד (₪)")}
            {num("insuranceYearly", "ביטוח שנתי (₪)")}
            <Field label="יש רישיון מתאים?">
              <Select value={String(data.hasLicense ?? "")} onChange={(e) => onChange({ ...data, hasLicense: e.target.value || null })}>
                <option value="">לא ידוע</option>
                <option value="yes">כן</option>
                <option value="no">לא</option>
              </Select>
            </Field>
          </>
        )}
        {kind === "weight" && (
          <>
            {num("currentWeight", "משקל נוכחי מאושר (ק״ג)")}
            {num("targetGain", "יעד עלייה (ק״ג)")}
          </>
        )}
        {kind === "portfolio" && (
          <>
            {num("currentValue", "שווי תיק נוכחי (₪)")}
            {num("target", "יעד (₪)")}
          </>
        )}
      </div>
    </div>
  );
}

function initialForm(goal: Goal | null, today: string, db?: ReturnType<typeof useStore.getState>["db"]) {
  const data: FormData = {};
  if (goal && db) {
    if (goal.kind === "motorcycle") {
      const info = (goal.info ?? {}) as Partial<MotorcycleInfo>;
      Object.assign(data, {
        model: info.model ?? "",
        price: info.price ?? null,
        licenseCost: info.licenseCost ?? null,
        gearCost: info.gearCost ?? null,
        insuranceYearly: info.insuranceYearly ?? null,
        otherCosts: info.otherCosts ?? null,
        monthlySavingCapacity: info.monthlySavingCapacity ?? null,
      });
      if (goal.financeAccountId) {
        const es = Object.values(db.financeEntries).filter((e) => e.accountId === goal.financeAccountId);
        data.savedSoFar = es.length ? summarizeAccount(es).currentValue : null;
      }
    } else if (goal.kind === "weight") {
      data.currentWeight = latestWeight(Object.values(db.weightLogs))?.kg ?? goal.startValue ?? null;
      data.targetGain = (goal.info as { targetGain?: number }).targetGain ?? 10;
    } else if (goal.kind === "portfolio") {
      const es = goal.financeAccountId ? Object.values(db.financeEntries).filter((e) => e.accountId === goal.financeAccountId) : [];
      data.currentValue = es.length ? summarizeAccount(es).currentValue : null;
      data.target = goal.targetValue ?? 30000;
    }
  }
  return {
    kind: goal?.kind ?? ("custom" as Goal["kind"]),
    title: goal?.title ?? "",
    description: goal?.description ?? "",
    startDate: goal?.startDate && goal.startDate > today ? goal.startDate : today,
    targetDate: goal?.targetDate ?? addMonths(today, 12),
    currentState: "",
    desiredOutcome: "",
    constraints: "",
    commitments: "",
    data,
  };
}
