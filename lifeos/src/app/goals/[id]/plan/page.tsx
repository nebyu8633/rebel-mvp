"use client";
import Link from "next/link";
import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, CalendarCheck, MessageSquare, Pencil, Plus, RotateCcw, AlertTriangle, Flag, Repeat, Target, Lock, Trash2, Undo2, ChevronDown, Compass, CalendarRange, CalendarDays, ListChecks, TrendingUp, ShieldAlert } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useToday } from "@/hooks/useToday";
import {
  approveAndActivate,
  approvedOf,
  discardDraft,
  draftOf,
  previewActivation,
  reschedule,
  saveDraftPlan,
  startRevision,
  KIND_LABEL,
} from "@/lib/goalplan/session";
import type { ActivationSummary } from "@/lib/goalplan/activation";
import { ids } from "@/lib/goalplan/activation";
import type { GoalPlan, GPRoutine, GPTask } from "@/lib/goalplan/schema";
import { addDays, formatDuration, formatHebDate, startOfWeek, WEEKDAYS_HE, WEEKDAYS_SHORT_HE, MONTHS_HE, parseDate } from "@/lib/dates";
import { isOpen } from "@/lib/tasks";
import { Badge, Button, Card, Details, Disclosure, EmptyState, Input, Modal, ProgressBar, Select, Spinner, Stat, confirmDialog, cx } from "@/components/ui";
import { PRIORITY_LABELS } from "@/components/TaskEditor";
import { FACT_KIND } from "@/components/goalchat/factKind";

export default function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const db = useStore((s) => s.db);
  const toast = useStore((s) => s.toast);
  const today = useToday();
  const router = useRouter();
  const goal = db.goals[id];
  const draft = draftOf(db, id);
  const approved = approvedOf(db, id);
  const version = draft ?? approved;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ActivationSummary | null>(null);
  const [showIssues, setShowIssues] = useState(false);

  // execution status of the approved plan (same task records as the calendar)
  const exec = useExecution(id);
  const report = useMemo(() => (version && version.status === "draft" ? reschedule(db, id, version.plan, today).report : null), [db, id, version, today]);

  if (!goal) return <EmptyState title="המטרה לא נמצאה" action={<Link href="/goals" className="text-accent-700">למטרות</Link>} />;
  if (!version)
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState
          icon={<Target size={28} />}
          title="עדיין אין תוכנית למטרה הזו"
          action={
            <Link href={`/goals/${id}/chat`}>
              <Button variant="primary">
                <MessageSquare size={16} /> לשיחת התכנון
              </Button>
            </Link>
          }
        >
          התוכנית נבנית מתוך שיחה קצרה, ומוצגת כאן לבדיקה ועריכה לפני שמשהו נכנס ללוח השנה.
        </EmptyState>
      </div>
    );

  const isDraft = version.status === "draft";
  const monthly = version.plan.milestones.filter((m) => !m.excluded).flatMap((m) => m.monthlyObjectives).sort((a, b) => (a.month < b.month ? -1 : 1));
  const warningsCount = version.plan.warnings.length + (report ? report.notes.length + report.overloaded.length : 0);
  const plan = version.plan;
  const canEdit = isDraft && editing;

  async function save(next: GoalPlan) {
    setError(null);
    const r = await saveDraftPlan(version!.id, next, today);
    if (!r.ok) setError(r.error ?? "השמירה נכשלה");
  }
  const editTask = (key: string, patch: Partial<GPTask>) => save({ ...plan, tasks: plan.tasks.map((t) => (t.key === key ? { ...t, ...patch, userEdited: true } : t)) });
  const editRoutine = (key: string, patch: Partial<GPRoutine>) => save({ ...plan, routines: plan.routines.map((r) => (r.key === key ? { ...r, ...patch, userEdited: true } : r)) });

  async function approve() {
    if (!version || !isDraft) return;
    setError(null);
    if (report?.needsAvailability && plan.tasks.some((t) => !t.excluded && !t.date)) {
      const ok = await confirmDialog({
        title: "משימות בלי תאריך ביצוע",
        message: "לא הוגדרה זמינות, ולכן חלק מהמשימות יישמרו עם דדליין בלבד (ברשימת ״ללא תאריך״). אפשר להגדיר זמינות בהגדרות ואז לשבץ מחדש. להמשיך?",
        confirmLabel: "להמשיך",
      });
      if (!ok) return;
    }
    if (report?.overloaded.length) {
      const ok = await confirmDialog({
        title: "עומס מעבר לזמן הפנוי",
        message: `${report.overloaded.length} משימות לא נכנסות בזמן הפנוי ושובצו בדדליין שלהן למרות העומס. אפשרויות: ${report.alternatives.map((a) => a.label).join(" · ")}. לאשר בכל זאת?`,
        confirmLabel: "לאשר בכל זאת",
        danger: true,
      });
      if (!ok) return;
    }
    if (approved) {
      // revision: show what will change before touching the calendar
      setPreview(previewActivation(id, version.id, today));
      return;
    }
    await activate();
  }

  async function activate() {
    setBusy(true);
    try {
      const r = await approveAndActivate(id, version!.id, today);
      if (!r.ok) {
        setError(`האישור נכשל ושום דבר לא נשמר: ${r.error}`);
        return;
      }
      setPreview(null);
      setEditing(false);
      toast(`התוכנית הופעלה: ${r.summary.created.length} פריטים נוספו ללוח${r.summary.updated.length ? `, ${r.summary.updated.length} עודכנו` : ""}`, "success");
      router.replace(`/goals/${id}/plan`);
    } finally {
      setBusy(false);
    }
  }


  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/goals/${id}`} className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
          <ArrowRight size={14} /> {goal.title}
        </Link>
        <Link href={`/goals/${id}/chat`}>
          <Button size="sm" variant="ghost">
            <MessageSquare size={14} /> שיחה
          </Button>
        </Link>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-900/20 dark:text-rose-200">
          {error}
        </div>
      )}

      {/* Summary */}
      <Card className="animate-in">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{goal.title}</h1>
          <Badge tone={isDraft ? "amber" : "accent"}>{isDraft ? `טיוטה · v${version.version}` : `פעילה · v${version.version}`}</Badge>
          {isDraft && approved && <Badge>עדכון ל-v{approved.version}</Badge>}
        </div>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{plan.outcome}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {canEdit ? (
            <label className="min-w-0 rounded-xl bg-stone-50 px-3 py-2 dark:bg-white/[0.03]">
              <span className="block text-[11px] text-stone-500">תאריך יעד</span>
              <Input type="date" className="mt-0.5 py-1 text-sm" defaultValue={plan.targetDate} min={addDays(today, 1)} onBlur={(e) => e.target.value && e.target.value !== plan.targetDate && save({ ...plan, targetDate: e.target.value })} aria-label="תאריך יעד" />
            </label>
          ) : (
            <Stat label="תאריך יעד" value={formatHebDate(plan.targetDate, { year: true })} />
          )}
          <Stat label="אבני דרך" value={plan.milestones.filter((m) => !m.excluded).length} />
          <Stat label="משימות" value={!isDraft && exec.total ? `${exec.done}/${exec.total}` : plan.tasks.filter((t) => !t.excluded).length} sub={!isDraft && exec.overdue ? `${exec.overdue} באיחור` : undefined} tone={!isDraft && exec.overdue ? "warn" : undefined} />
          <Stat label="שגרות" value={plan.routines.filter((r) => !r.excluded).length} sub={`בדיקה ב${WEEKDAYS_HE[plan.review.weekday]}`} />
        </div>
        {!isDraft && exec.total > 0 && <ProgressBar className="mt-3 h-1.5" value={exec.done / exec.total} label="ביצוע משימות" />}

        {(warningsCount > 0) && (
          <button onClick={() => setShowIssues((v) => !v)} className="mt-3 flex w-full items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-start text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-100" aria-expanded={showIssues}>
            <AlertTriangle size={15} className="shrink-0" />
            <span className="flex-1">{warningsCount} דברים לבדוק לפני אישור</span>
            <ChevronDown size={15} className={cx("transition-transform", showIssues && "rotate-180")} />
          </button>
        )}
        {showIssues && (
          <div className="animate-in mt-2 space-y-2 text-sm">
            <ul className="space-y-1">
              {plan.warnings.map((w) => (
                <li key={w}>• {w}</li>
              ))}
              {report?.notes.map((n) => (
                <li key={n}>• {n}</li>
              ))}
              {report?.overloaded.map((o) => (
                <li key={o.key} className="text-amber-800 dark:text-amber-200">
                  • ״{o.title}״ לא נכנסת בזמן הפנוי עד {formatHebDate(o.deadline)}
                </li>
              ))}
            </ul>
            {report && report.alternatives.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {report.alternatives.map((a) =>
                  a.id === "reduce" ? (
                    <Button key={a.id} size="sm" onClick={() => save({ ...plan, tasks: plan.tasks.map((t) => (t.priority === "low" ? { ...t, excluded: true, userEdited: true } : t)) })}>
                      {a.label}
                    </Button>
                  ) : (
                    <Link key={a.id} href={`/goals/${id}/chat`}>
                      <Button size="sm">{a.label}</Button>
                    </Link>
                  ),
                )}
              </div>
            )}
            {report?.needsAvailability && (
              <Link href="/settings" className="inline-block text-sm text-accent-700">
                הגדרת זמינות ←
              </Link>
            )}
          </div>
        )}
      </Card>

      <Disclosure id={`p-${id}-strategy`} icon={<Compass size={16} />} title="אסטרטגיה" summary={plan.strategy} forceOpen={canEdit}>
        <p className="text-sm leading-relaxed">{plan.strategy}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <PlanField label="תוצאה רצויה" value={plan.outcome} editable={canEdit} onSave={(v) => save({ ...plan, outcome: v })} />
          <PlanField label="נקודת התחלה" value={plan.baseline} editable={canEdit} onSave={(v) => save({ ...plan, baseline: v })} />
        </div>
        <div className="mt-4">
          <div className="mb-1 text-xs text-stone-500">מדדי הצלחה</div>
          <ListEditor items={plan.successCriteria} editable={canEdit} onChange={(items) => save({ ...plan, successCriteria: items })} />
        </div>
        {plan.resources.length > 0 && <p className="mt-3 text-xs text-stone-500">משאבים: {plan.resources.join(" · ")}</p>}
        {plan.rationale && <Details className="mt-2" label="למה">{plan.rationale}</Details>}
      </Disclosure>

      <Disclosure id={`p-${id}-ms`} defaultOpen icon={<Flag size={16} />} title="אבני דרך" summary={`${plan.milestones.filter((m) => !m.excluded).length}`}>
        <ol className="relative space-y-4 border-s-2 border-accent-100 ps-5 dark:border-accent-800/40">
          {plan.milestones.map((m, i) => {
            const msTasks = plan.tasks.filter((t) => t.milestoneKey === m.key && !t.excluded);
            const rec = db.milestones[ids.milestone(id, m.key)];
            return (
              <li key={m.key} className={cx("relative", m.excluded && "opacity-50")}>
                <span className={cx("absolute -start-[29px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold", rec?.status === "done" ? "bg-accent-600 text-white" : "bg-white ring-2 ring-accent-500 dark:bg-stone-900")}>{rec?.status === "done" ? <Check size={11} /> : i + 1}</span>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  {canEdit ? (
                    <Input className="max-w-sm py-1" defaultValue={m.title} aria-label="כותרת אבן דרך" onBlur={(e) => e.target.value.trim() && e.target.value !== m.title && save({ ...plan, milestones: plan.milestones.map((x) => (x.key === m.key ? { ...x, title: e.target.value.trim() } : x)) })} />
                  ) : (
                    <span className="font-medium">{m.title}</span>
                  )}
                  <span className="flex items-center gap-2 text-xs text-stone-500">
                    {canEdit ? (
                      <Input type="date" className="w-auto py-1 text-xs" defaultValue={m.targetDate} max={plan.targetDate} aria-label="תאריך אבן דרך" onBlur={(e) => e.target.value && save({ ...plan, milestones: plan.milestones.map((x) => (x.key === m.key ? { ...x, targetDate: e.target.value } : x)) })} />
                    ) : (
                      formatHebDate(m.targetDate, { year: true })
                    )}
                    <Badge>{msTasks.length}</Badge>
                    {canEdit && (
                      <button className="text-stone-500 hover:text-stone-800" onClick={() => save({ ...plan, milestones: plan.milestones.map((x) => (x.key === m.key ? { ...x, excluded: !x.excluded } : x)) })} aria-label={m.excluded ? "החזרת אבן הדרך" : "הסרת אבן הדרך"}>
                        {m.excluded ? <Undo2 size={14} /> : <Trash2 size={14} />}
                      </button>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </Disclosure>

      {monthly.length > 0 && (
        <Disclosure id={`p-${id}-month`} icon={<CalendarRange size={16} />} title="תוכנית חודשית" summary={`${monthly.length} יעדים`}>
          <ul className="space-y-1.5 text-sm">
            {monthly.map((o) => (
              <li key={o.key} className="flex gap-3">
                <span className="w-16 shrink-0 text-xs font-semibold text-stone-500">{MONTHS_HE[parseDate(o.month).getUTCMonth()]}</span>
                <span>{o.title}</span>
              </li>
            ))}
          </ul>
        </Disclosure>
      )}

      <Disclosure id={`p-${id}-week`} icon={<CalendarDays size={16} />} title="תוכנית שבועית" summary={weeklySummary(plan, today)}>
        <WeeklyPlan plan={plan} today={today} />
      </Disclosure>

      <Disclosure
        id={`p-${id}-tasks`}
        forceOpen={canEdit}
        icon={<ListChecks size={16} />}
        title="משימות"
        summary={`${plan.tasks.filter((t) => !t.excluded).length}${isDraft ? "" : " · מסונכרנות ללוח"}`}
      >
        <ul className="divide-y hairline">
          {plan.tasks.map((t) => (
            <TaskLine key={t.key} t={t} plan={plan} goalId={id} canEdit={canEdit} onEdit={(p) => editTask(t.key, p)} />
          ))}
        </ul>
        {canEdit && (
          <Button
            size="sm"
            variant="ghost"
            className="mt-2"
            onClick={() => {
              const key = `u-${Date.now().toString(36)}`;
              void save({ ...plan, tasks: [...plan.tasks, { key, milestoneKey: null, title: "משימה חדשה", notes: "", durationMinutes: 30, deadline: plan.targetDate, priority: "medium", rationale: "נוספה ידנית", dependsOn: [], date: null, startTime: null, reminderMinutes: null, excluded: false, userEdited: true }] });
            }}
          >
            <Plus size={14} /> משימה
          </Button>
        )}
      </Disclosure>

      <Disclosure id={`p-${id}-routines`} icon={<Repeat size={16} />} title="שגרות" summary={plan.routines.filter((r) => !r.excluded).map((r) => r.title).join(" · ") || "אין"} forceOpen={canEdit}>
        {plan.routines.length > 0 && (
          <ul className="space-y-3">
            {plan.routines.map((r) => (
              <RoutineLine key={r.key} r={r} canEdit={canEdit} onEdit={(p) => editRoutine(r.key, p)} />
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
          <Repeat size={13} /> בדיקת התקדמות: {plan.review.freq === "weekly" ? "כל שבוע" : "כל חודש"}, {WEEKDAYS_HE[plan.review.weekday]}
          {canEdit && (
            <Select className="w-auto py-0.5 text-xs" value={plan.review.weekday} onChange={(e) => save({ ...plan, review: { ...plan.review, weekday: Number(e.target.value) } })} aria-label="יום בדיקה">
              {WEEKDAYS_HE.map((d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              ))}
            </Select>
          )}
        </div>
        <Details className="mt-2" label="יום גיבוי?">יום גיבוי הוא חלופה למפגש שפוספס, לא מפגש נוסף.</Details>
      </Disclosure>

      <Disclosure id={`p-${id}-progress`} icon={<TrendingUp size={16} />} title="התקדמות" summary={plan.metrics.filter((m) => m.type === "outcome").map((m) => m.name).join(" · ")}>
        <ul className="space-y-2 text-sm">
          {plan.metrics.map((m) => (
            <li key={m.key} className="flex flex-wrap items-center gap-2">
              <Badge tone={m.type === "outcome" ? "accent" : "stone"}>{m.type === "outcome" ? "תוצאה" : "פעילות"}</Badge>
              <span className="font-medium">{m.name}</span>
              <span className="ltr-nums text-xs text-stone-500">
                {m.baseline != null ? m.baseline : "?"} → {m.target != null ? m.target : "?"} {m.unit}
              </span>
            </li>
          ))}
        </ul>
        <Link href={`/goals/${id}`} className="mt-3 inline-block text-sm text-accent-700">
          עדכון מדדים בעמוד המטרה ←
        </Link>
      </Disclosure>

      <Disclosure id={`p-${id}-risks`} icon={<ShieldAlert size={16} />} title="סיכונים והנחות" summary={`${plan.risks.length} סיכונים · ${plan.assumptions.length + plan.unresolved.length} הנחות`}>
        <ul className="space-y-2 text-sm">
          {plan.risks.map((r, i) => (
            <li key={i}>
              <span className="font-medium">{r.risk}</span>
              <span className="block text-xs text-stone-500">← {r.mitigation}</span>
            </li>
          ))}
        </ul>
        <ul className="mt-3 space-y-1.5 border-t hairline pt-3 text-sm">
          {plan.assumptions.map((a, i) => (
            <li key={i} className="flex items-start gap-2">
              <Badge tone={FACT_KIND[a.kind].tone}>{FACT_KIND[a.kind].label}</Badge>
              <span>{a.text}</span>
            </li>
          ))}
          {plan.unresolved.map((u) => (
            <li key={u} className="flex items-start gap-2">
              <Badge tone="rose">פתוח</Badge>
              <span>{u}</span>
            </li>
          ))}
        </ul>
      </Disclosure>

      {/* Action bar */}
      <div className="surface pb-safe fixed inset-x-0 bottom-16 z-30 border-t p-3 shadow-lg lg:bottom-0 lg:start-60">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
          {isDraft ? (
            <>
              <Button variant="primary" className="flex-1 sm:flex-none" onClick={approve} disabled={busy}>
                {busy ? <Spinner /> : <CalendarCheck size={16} />} אישור התוכנית והוספה ללוח השנה
              </Button>
              <Button onClick={() => setEditing((e) => !e)} aria-pressed={editing} aria-label={editing ? "סיום עריכה" : "עריכת התוכנית"}>
                <Pencil size={14} /> <span className="hidden sm:inline">{editing ? "סיום עריכה" : "עריכת התוכנית"}</span>
              </Button>
              <Link href={`/goals/${id}/chat`} aria-label="המשך תכנון עם ה-AI">
                <Button>
                  <MessageSquare size={14} /> <span className="hidden sm:inline">המשך תכנון עם ה-AI</span>
                </Button>
              </Link>
              {editing && (
                <Button variant="ghost" aria-label="שיבוץ מחדש" onClick={async () => {
                  const { plan: p } = reschedule(db, id, { ...plan, tasks: plan.tasks.map((t) => ({ ...t, userEdited: false })) }, today);
                  await save(p);
                }}>
                  <RotateCcw size={14} /> <span className="hidden sm:inline">שיבוץ מחדש</span>
                </Button>
              )}
              <Button
                variant="ghost"
                aria-label="ביטול טיוטה"
                className="text-rose-600 sm:ms-auto"
                onClick={async () => {
                  if (await confirmDialog({ title: "לבטל את הטיוטה?", message: approved ? "התוכנית הפעילה לא תשתנה." : "השיחה והתשובות נשמרות.", danger: true, confirmLabel: "ביטול טיוטה" })) {
                    await discardDraft(version.id);
                  }
                }}
              >
                <Trash2 size={14} /> <span className="hidden sm:inline">ביטול טיוטה</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="primary"
                onClick={async () => {
                  const d = await startRevision(id);
                  if (d) setEditing(true);
                }}
              >
                <Pencil size={14} /> עריכת התוכנית
              </Button>
              <Link href={`/goals/${id}/chat`}>
                <Button>
                  <MessageSquare size={14} /> המשך תכנון עם ה-AI
                </Button>
              </Link>
              <span className="ms-auto flex items-center gap-1 text-xs text-stone-500">
                <Lock size={12} /> מאושרת · עריכה יוצרת גרסה חדשה
              </span>
            </>
          )}
        </div>
      </div>

      {preview && (
        <Modal
          open
          wide
          onClose={() => setPreview(null)}
          title="תצוגה מקדימה של השינויים"
          footer={
            <>
              <Button onClick={() => setPreview(null)}>חזרה</Button>
              <Button variant="primary" onClick={activate} disabled={busy}>
                {busy ? <Spinner /> : <Check size={16} />} אישור והחלה
              </Button>
            </>
          }
        >
          <ChangeList title="יתווספו" items={preview.created} tone="accent" />
          <ChangeList title="יעודכנו" items={preview.updated.map((u) => `${u.title} (${u.changes.join(", ")})`)} tone="sky" />
          <ChangeList title="יוסרו (לא הושלמו)" items={preview.removed} tone="rose" />
          <ChangeList title="סדרות שיסתיימו (ההיסטוריה נשמרת)" items={preview.endedSeries} tone="amber" />
          <ChangeList title="הושלמו — נשמרים ללא שינוי" items={preview.keptCompleted} tone="stone" />
        </Modal>
      )}
    </div>
  );
}

function weeklySummary(plan: GoalPlan, today: string) {
  const ws = startOfWeek(today);
  const n = plan.tasks.filter((t) => !t.excluded && t.date && t.date >= ws && t.date <= addDays(ws, 6));
  return n.length ? `השבוע: ${n.length} · ${formatDuration(n.reduce((s, t) => s + t.durationMinutes, 0))}` : "השבוע: אין";
}

function useExecution(goalId: string) {
  const db = useStore((s) => s.db);
  const today = useToday();
  const ts = Object.values(db.tasks).filter((t) => t.goalId === goalId && t.id.startsWith(`pt:${goalId}:`));
  return {
    total: ts.length,
    done: ts.filter((t) => t.status === "completed").length,
    overdue: ts.filter((t) => isOpen(t.status) && t.date && t.date < today).length,
  };
}

function ChangeList({ title, items, tone }: { title: string; items: string[]; tone: "accent" | "sky" | "rose" | "amber" | "stone" }) {
  if (!items.length) return null;
  return (
    <div className="mb-3">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        {title} <Badge tone={tone}>{items.length}</Badge>
      </h3>
      <ul className="space-y-0.5 text-sm text-stone-600 dark:text-stone-300">
        {items.map((x, i) => (
          <li key={i}>• {x}</li>
        ))}
      </ul>
    </div>
  );
}

function PlanField({ label, value, editable, onSave }: { label: string; value: string; editable: boolean; onSave: (v: string) => void }) {
  return (
    <div>
      <div className="text-xs text-stone-500">{label}</div>
      {editable ? (
        <Input className="mt-1" defaultValue={value} aria-label={label} onBlur={(e) => e.target.value.trim() && e.target.value !== value && onSave(e.target.value.trim())} />
      ) : (
        <div className="mt-0.5 font-medium">{value || "—"}</div>
      )}
    </div>
  );
}

function ListEditor({ items, editable, onChange }: { items: string[]; editable: boolean; onChange: (items: string[]) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <ul className="space-y-1 text-sm">
        {items.map((x, i) => (
          <li key={i} className="flex items-center gap-2">
            <Flag size={12} className="shrink-0 text-accent-600" />
            <span className="flex-1">{x}</span>
            {editable && (
              <button aria-label={`הסרה: ${x}`} className="text-stone-400 hover:text-rose-600" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <Trash2 size={13} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {editable && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) {
              onChange([...items, draft.trim()]);
              setDraft("");
            }
          }}
        >
          <Input className="py-1 text-sm" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="מדד נוסף" aria-label="מדד הצלחה נוסף" />
          <Button size="sm" type="submit">
            <Plus size={14} />
          </Button>
        </form>
      )}
    </div>
  );
}

function WeeklyPlan({ plan, today }: { plan: GoalPlan; today: string }) {
  const weeks = new Map<string, GPTask[]>();
  for (const t of plan.tasks.filter((x) => !x.excluded && x.date).sort((a, b) => (a.date! < b.date! ? -1 : 1))) {
    const w = startOfWeek(t.date!);
    weeks.set(w, [...(weeks.get(w) ?? []), t]);
  }
  const first = [...weeks.entries()].slice(0, 6);
  if (!first.length) return <p className="text-sm text-stone-500">אין משימות עם תאריך.</p>;
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {first.map(([w, ts]) => (
          <div key={w} className={cx("rounded-xl border hairline p-3", w === startOfWeek(today) && "border-accent-300 dark:border-accent-700")}>
            <div className="mb-1 text-xs font-semibold text-stone-500">
              שבוע {formatHebDate(w)} · {formatDuration(ts.reduce((s, t) => s + t.durationMinutes, 0))}
            </div>
            <ul className="space-y-1 text-sm">
              {ts.map((t) => (
                <li key={t.key} className="flex gap-2">
                  <span className="w-6 shrink-0 text-xs text-stone-500">{WEEKDAYS_SHORT_HE[parseDate(t.date!).getUTCDay()]}</span>
                  <span className="truncate">{t.title}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskLine({ t, plan, goalId, canEdit, onEdit }: { t: GPTask; plan: GoalPlan; goalId: string; canEdit: boolean; onEdit: (p: Partial<GPTask>) => void }) {
  const db = useStore((s) => s.db);
  const live = db.tasks[ids.task(goalId, t.key)];
  const deps = t.dependsOn.map((d) => plan.tasks.find((x) => x.key === d)?.title).filter(Boolean);
  const ms = plan.milestones.find((m) => m.key === t.milestoneKey);
  return (
    <li className={cx("py-3", t.excluded && "opacity-50")}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          {canEdit ? (
            <Input className="py-1" defaultValue={t.title} aria-label="כותרת משימה" onBlur={(e) => e.target.value.trim() && e.target.value !== t.title && onEdit({ title: e.target.value.trim() })} />
          ) : (
            <div className={cx("font-medium", live?.status === "completed" && "line-through text-stone-400")}>{live?.title ?? t.title}</div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
            {live && <Badge tone={live.status === "completed" ? "accent" : "stone"}>{live.status === "completed" ? "הושלמה" : live.date ? `מתוכנן ל-${formatHebDate(live.date)}` : "ללא תאריך"}</Badge>}
            {!live && <span>{t.date ? `${WEEKDAYS_HE[parseDate(t.date).getUTCDay()]} ${formatHebDate(t.date)}${t.startTime ? ` ${t.startTime}` : ""}` : "ללא תאריך ביצוע"}</span>}
            <span>· {formatDuration(t.durationMinutes)}</span>
            <span>· עד {formatHebDate(t.deadline)}</span>
            <Badge tone={t.priority === "high" ? "amber" : "stone"}>{PRIORITY_LABELS[t.priority]}</Badge>
            {ms && <span>· {ms.title}</span>}
            {deps.length > 0 && <Badge tone="sky">אחרי: {deps.join(", ")}</Badge>}
            {t.userEdited && <Badge>נערך ידנית</Badge>}
          </div>
          {t.rationale && <Details className="mt-1" label="למה">{t.rationale}</Details>}
        </div>
        {canEdit && (
          <button className="p-1 text-stone-500 hover:text-stone-800" onClick={() => onEdit({ excluded: !t.excluded })} aria-label={t.excluded ? "החזרת משימה" : "הסרת משימה מהתוכנית"}>
            {t.excluded ? <Undo2 size={15} /> : <Trash2 size={15} />}
          </button>
        )}
      </div>
      {canEdit && !t.excluded && live && !isOpen(live.status) && <p className="mt-1 text-xs text-stone-500">הושלמה — נשמרת כפי שהיא בכל גרסה.</p>}
      {canEdit && !t.excluded && !(live && !isOpen(live.status)) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <Input type="date" className="w-auto py-1 text-xs" defaultValue={t.date ?? ""} max={t.deadline} aria-label="תאריך ביצוע" onBlur={(e) => onEdit({ date: e.target.value || null })} />
          <Input type="time" className="w-auto py-1 text-xs" defaultValue={t.startTime ?? ""} aria-label="שעה" onBlur={(e) => onEdit({ startTime: e.target.value || null })} />
          <Input type="number" min={5} max={480} className="w-20 py-1 text-xs" defaultValue={t.durationMinutes} aria-label="משך בדקות" onBlur={(e) => Number(e.target.value) !== t.durationMinutes && onEdit({ durationMinutes: Number(e.target.value) || 15 })} />
          <span>דק׳</span>
          <Input type="date" className="w-auto py-1 text-xs" defaultValue={t.deadline} max={plan.targetDate} aria-label="דדליין" onBlur={(e) => e.target.value && e.target.value !== t.deadline && onEdit({ deadline: e.target.value })} />
          <Select className="w-auto py-1 text-xs" value={t.priority} aria-label="עדיפות" onChange={(e) => onEdit({ priority: e.target.value as GPTask["priority"] })}>
            {(["high", "medium", "low"] as const).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </Select>
          <Select className="w-auto py-1 text-xs" value={t.reminderMinutes ?? ""} aria-label="תזכורת" disabled={!t.startTime} onChange={(e) => onEdit({ reminderMinutes: e.target.value === "" ? null : Number(e.target.value) })}>
            <option value="">ללא תזכורת</option>
            <option value="0">בזמן ההתחלה</option>
            <option value="15">15 דק׳ לפני</option>
            <option value="60">שעה לפני</option>
          </Select>
        </div>
      )}
    </li>
  );
}

function RoutineLine({ r, canEdit, onEdit }: { r: GPRoutine; canEdit: boolean; onEdit: (p: Partial<GPRoutine>) => void }) {
  const when = r.freq === "weekly" ? `כל שבוע: ${r.byWeekday.map((d) => WEEKDAYS_HE[d]).join(", ")}` : r.freq === "monthly" ? `כל חודש ב-${r.byMonthDay}` : "כל יום";
  return (
    <li className={cx("rounded-xl border hairline p-3", r.excluded && "opacity-50")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium">
            <Repeat size={13} className="me-1 inline text-stone-400" />
            {r.title}
          </div>
          <div className="text-xs text-stone-500">
            {when}
            {r.backupWeekday != null && ` · גיבוי: ${WEEKDAYS_HE[r.backupWeekday]}`} · {formatDuration(r.durationMinutes)}
            {r.startTime && ` · ${r.startTime}`}
          </div>
        </div>
        {canEdit && (
          <button className="p-1 text-stone-500" onClick={() => onEdit({ excluded: !r.excluded })} aria-label={r.excluded ? "החזרת שגרה" : "הסרת שגרה"}>
            {r.excluded ? <Undo2 size={15} /> : <Trash2 size={15} />}
          </button>
        )}
      </div>
      {canEdit && !r.excluded && r.freq === "weekly" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <div className="flex gap-1" role="group" aria-label="ימים">
            {WEEKDAYS_SHORT_HE.map((d, i) => {
              const on = r.byWeekday.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={on}
                  aria-label={WEEKDAYS_HE[i]}
                  onClick={() => {
                    const next = on ? r.byWeekday.filter((x) => x !== i) : [...r.byWeekday, i].sort();
                    if (next.length) onEdit({ byWeekday: next, backupWeekday: r.backupWeekday != null && next.includes(r.backupWeekday) ? null : r.backupWeekday });
                  }}
                  className={cx("h-7 w-7 rounded-full", on ? "bg-accent-600 text-white" : "surface border")}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <Select className="w-auto py-1 text-xs" value={r.backupWeekday ?? ""} aria-label="יום גיבוי" onChange={(e) => onEdit({ backupWeekday: e.target.value === "" ? null : Number(e.target.value) })}>
            <option value="">ללא יום גיבוי</option>
            {WEEKDAYS_HE.map((d, i) => (r.byWeekday.includes(i) ? null : <option key={i} value={i}>גיבוי: {d}</option>))}
          </Select>
          <Input type="time" className="w-auto py-1 text-xs" defaultValue={r.startTime ?? ""} aria-label="שעה" onBlur={(e) => onEdit({ startTime: e.target.value || null })} />
          <Input type="number" min={5} max={480} className="w-20 py-1 text-xs" defaultValue={r.durationMinutes} aria-label="משך" onBlur={(e) => Number(e.target.value) !== r.durationMinutes && onEdit({ durationMinutes: Number(e.target.value) || 15 })} />
          <span>דק׳</span>
        </div>
      )}
    </li>
  );
}
