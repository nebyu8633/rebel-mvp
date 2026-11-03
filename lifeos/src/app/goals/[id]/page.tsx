"use client";
import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Pencil, Trash2, Sparkles, Plus, Flag, CalendarDays, ArrowLeft, Repeat, Compass, CalendarRange, ListChecks, TrendingUp, FileText, MessageSquare, Check, ChevronDown } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useUI } from "@/lib/store/ui";
import { useToday } from "@/hooks/useToday";
import { goalColor, goalSnapshot, milestoneCompletion, GOAL_STATUS } from "@/lib/goals";
import { addDays, diffDays, formatHebDate, MONTHS_HE, parseDate, relativeDayLabel, startOfWeek, formatDuration } from "@/lib/dates";
import { singleInstance, instancesInRange, overdueInstances, isOpen, type TaskInstance } from "@/lib/tasks";
import { approvedOf, draftOf } from "@/lib/goalplan/session";
import { describeRule } from "@/lib/recurrence";
import { RecoveryModal } from "@/components/RecoveryModal";
import { deleteGoal, deleteMilestone, nowIso, toggleComplete, uid } from "@/lib/actions";
import { motorcycleCost } from "@/lib/finance";
import { Badge, Button, Card, Details, Disclosure, EmptyState, Field, Input, Modal, ProgressBar, Ring, Select, confirmDialog, cx } from "@/components/ui";
import { TaskRow } from "@/components/TaskRow";
import { GoalForm, MotorcycleInfoForm, WeightLogger, WeightStart } from "@/components/GoalForms";
import { FinanceEntries, FinanceSummary, PortfolioScenarios } from "@/components/FinancePanel";
import { LineChart } from "@/components/charts";
import type { Milestone, MotorcycleInfo } from "@/lib/types";

export default function GoalDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const db = useStore((s) => s.db);
  const today = useToday();
  const router = useRouter();
  const openEditor = useUI((s) => s.openEditor);
  const [editing, setEditing] = useState(false);
  const [msEdit, setMsEdit] = useState<Milestone | null>(null);
  const [recovery, setRecovery] = useState(false);
  const goal = db.goals[id];

  if (!goal) return <EmptyState title="המטרה לא נמצאה" action={<Link href="/goals" className="text-accent-700">למטרות</Link>} />;

  const snap = goalSnapshot(db, goal, today);
  const p = snap.progress;
  const c = goalColor(goal.color);
  const approved = approvedOf(db, id);
  const draft = draftOf(db, id);
  const plan = (approved ?? draft)?.plan ?? null;
  const milestones = Object.values(db.milestones).filter((m) => m.goalId === id).sort((a, b) => a.order - b.order);
  const objectives = Object.values(db.objectives).filter((o) => o.goalId === id);
  const tasks = Object.values(db.tasks).filter((t) => t.goalId === id);
  const oneOff = tasks.filter((t) => !t.recurrence);
  const routines = tasks.filter((t) => t.recurrence);
  const oneOffDone = oneOff.filter((t) => t.status === "completed").length;
  const overdue = overdueInstances(db, today).filter((i) => i.task.goalId === id);
  const upcoming = instancesInRange(db, today, addDays(today, 60), today).filter((i) => i.task.goalId === id);
  const review = upcoming.find((i) => i.task.id === `rv:${id}` && isOpen(i.status));
  const daysLeft = diffDays(today, goal.targetDate);
  const monthObjs = objectives.filter((o) => o.level === "month").sort((a, b) => (a.periodStart < b.periodStart ? -1 : 1));
  const weekObjs = objectives.filter((o) => o.level === "week").sort((a, b) => (a.periodStart < b.periodStart ? -1 : 1));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link href="/goals" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
          <ArrowRight size={14} /> המטרות שלי
        </Link>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" aria-label="עריכת מטרה" onClick={() => setEditing(true)}>
            <Pencil size={16} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-rose-600"
            aria-label="מחיקת מטרה"
            onClick={async () => {
              if (await confirmDialog({ title: "למחוק את המטרה?", message: "המשימות יישארו, ללא שיוך למטרה.", danger: true, confirmLabel: "מחיקה" })) {
                if (await deleteGoal(id)) router.push("/goals");
              }
            }}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      {/* Summary */}
      <Card className="animate-in">
        <div className="flex items-start gap-4">
          <Ring value={p.fraction} size={72} stroke={7} colorClass={c.text} label="התקדמות" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{goal.title}</h1>
              <Badge tone={GOAL_STATUS[goal.status].tone}>{GOAL_STATUS[goal.status].label}</Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-500">
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={14} /> {formatHebDate(goal.targetDate, { year: true })}
              </span>
              {daysLeft > 0 && <span>{daysLeft} ימים</span>}
            </div>
            <div className="mt-2" title="כמה מהזמן עבר">
              <ProgressBar value={p.timeElapsed} className="h-1" barClass="bg-stone-300 dark:bg-stone-600" label="זמן שעבר" />
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Info icon={<Flag size={14} />} label="אבן הדרך הבאה" value={snap.nextMilestone?.title ?? "—"} sub={snap.nextMilestone?.targetDate ? formatHebDate(snap.nextMilestone.targetDate) : undefined} />
          <NextAction inst={snap.nextAction} today={today} />
          <Info icon={<Repeat size={14} />} label="בדיקה הבאה" value={review ? relativeDayLabel(review.date!, today) : "—"} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(approved || draft) && (
            <Link href={`/goals/${id}/plan`}>
              <Button variant="primary" size="sm">
                <FileText size={14} /> {draft ? `טיוטה (גרסה ${draft.version})` : "התוכנית"}
              </Button>
            </Link>
          )}
          <Link href={`/goals/${id}/chat`}>
            <Button size="sm" variant={approved || draft ? "secondary" : "primary"}>
              {approved || draft ? <MessageSquare size={14} /> : <Sparkles size={14} />} {approved || draft ? "שיחה" : "לבנות תוכנית"}
            </Button>
          </Link>
          {overdue.length > 0 && (
            <Button size="sm" variant="subtle" className="text-rose-700" onClick={() => setRecovery(true)}>
              {overdue.length} באיחור · לסדר מחדש
            </Button>
          )}
        </div>
      </Card>

      {plan && (
        <Disclosure id={`g-${id}-strategy`} icon={<Compass size={16} />} title="אסטרטגיה" summary={plan.strategy}>
          <p className="text-sm leading-relaxed">{plan.strategy}</p>
          {plan.successCriteria.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {plan.successCriteria.map((x) => (
                <li key={x} className="flex items-center gap-2">
                  <Check size={13} className="text-accent-600" /> {x}
                </li>
              ))}
            </ul>
          )}
          {plan.rationale && <Details className="mt-2" label="למה">{plan.rationale}</Details>}
        </Disclosure>
      )}

      <Disclosure
        id={`g-${id}-ms`}
        defaultOpen
        icon={<Flag size={16} />}
        title="אבני דרך"
        summary={milestones.length ? `${snap.milestonesDone}/${milestones.length}` : "אין עדיין"}
        action={
          <Button size="icon" variant="ghost" aria-label="אבן דרך חדשה" onClick={() => setMsEdit({ id: uid(), goalId: id, title: "", description: "", targetDate: null, status: "pending", order: milestones.length, planVersionId: null, createdAt: nowIso(), updatedAt: nowIso() })}>
            <Plus size={16} />
          </Button>
        }
      >
        {milestones.length === 0 ? (
          <p className="text-sm text-stone-500">נוצרות מתוכנית מאושרת או ידנית (+).</p>
        ) : (
          <ol className="relative space-y-1 border-s-2 border-stone-100 ps-4 dark:border-white/10">
            {milestones.map((m, i) => (
              <MilestoneRow key={m.id} m={m} index={i} goalColor="bg-accent-600" onEdit={() => setMsEdit(m)} onAddTask={() => openEditor({ defaults: { goalId: id, milestoneId: m.id, date: null } })} />
            ))}
          </ol>
        )}
      </Disclosure>

      {monthObjs.length > 0 && (
        <Disclosure id={`g-${id}-month`} icon={<CalendarRange size={16} />} title="תוכנית חודשית" summary={`${monthObjs.filter((o) => o.status === "done").length}/${monthObjs.length}`}>
          <ObjList title="" items={monthObjs.map((o) => ({ o, label: `${MONTHS_HE[parseDate(o.periodStart).getUTCMonth()]} — ${o.title}` }))} />
        </Disclosure>
      )}

      <Disclosure id={`g-${id}-week`} icon={<CalendarDays size={16} />} title="תוכנית שבועית" summary={weekSummary(upcoming, today)}>
        <WeekPlan upcoming={upcoming} today={today} />
        {weekObjs.length > 0 && (
          <div className="mt-3">
            <ObjList title="יעדים שבועיים" items={weekObjs.map((o) => ({ o, label: `${formatHebDate(o.periodStart)} — ${o.title}` }))} />
          </div>
        )}
      </Disclosure>

      <Disclosure
        id={`g-${id}-tasks`}
        icon={<ListChecks size={16} />}
        title="משימות"
        summary={`${oneOffDone}/${oneOff.length} הושלמו${routines.length ? ` · ${routines.length} חוזרות` : ""}`}
        action={
          <Button size="icon" variant="ghost" aria-label="משימה חדשה למטרה" onClick={() => openEditor({ defaults: { goalId: id } })}>
            <Plus size={16} />
          </Button>
        }
      >
        <ProgressBar value={oneOff.length ? oneOffDone / oneOff.length : null} className="mb-3 h-1.5" label="ביצוע משימות" />
        <div className="-mx-2">
          {oneOff
            .slice()
            .sort((a, b) => (isOpen(a.status) === isOpen(b.status) ? ((a.date ?? "9") < (b.date ?? "9") ? -1 : 1) : isOpen(a.status) ? -1 : 1))
            .map((t) => (
              <TaskRow key={t.id} inst={singleInstance(t)} showDate compact />
            ))}
        </div>
        {routines.length > 0 && (
          <ul className="mt-3 space-y-1 border-t hairline pt-3 text-sm">
            {routines.map((t) => (
              <li key={t.id}>
                <button className="flex w-full items-center gap-2 text-start hover:text-accent-700" onClick={() => openEditor({ task: t })}>
                  <Repeat size={13} className="text-stone-400" />
                  <span className="flex-1 truncate">{t.title}</span>
                  <span className="text-xs text-stone-500">{describeRule(t.recurrence!)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Disclosure>

      <Disclosure id={`g-${id}-progress`} defaultOpen={p.missing.length > 0} icon={<TrendingUp size={16} />} title="התקדמות" summary={progressSummary(p)}>
        <ProgressSection goalId={id} />
      </Disclosure>

      {editing && <GoalForm goal={goal} onClose={() => setEditing(false)} />}
      {msEdit && <MilestoneForm m={msEdit} onClose={() => setMsEdit(null)} />}
      {recovery && <RecoveryModal open onClose={() => setRecovery(false)} />}
    </div>
  );
}

function progressSummary(p: ReturnType<typeof goalSnapshot>["progress"]) {
  if (p.fraction == null) return p.current != null ? `${p.current} ${p.unit}` : "חסרים נתונים";
  return `${Math.round(p.fraction * 100)}%${p.current != null && p.target != null ? ` · ${p.current} / ${p.target} ${p.unit}` : ""}`;
}

function weekSummary(list: TaskInstance[], today: string) {
  const ws = startOfWeek(today);
  const thisWeek = list.filter((i) => i.date! <= addDays(ws, 6));
  const mins = thisWeek.reduce((s, i) => s + (i.task.estimatedMinutes ?? 0), 0);
  return thisWeek.length ? `השבוע: ${thisWeek.length} · ${formatDuration(mins) || "—"}` : "אין השבוע";
}

function Info({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-stone-50 px-3 py-2.5 dark:bg-white/[0.03]">
      <div className="flex items-center gap-1 text-[11px] text-stone-500">
        {icon} {label}
      </div>
      <div className="truncate text-sm font-medium">{value}</div>
      {sub && <div className="text-[11px] text-stone-500">{sub}</div>}
    </div>
  );
}

function NextAction({ inst, today }: { inst: TaskInstance | null; today: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl bg-accent-50/70 px-3 py-2.5 dark:bg-accent-800/15">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[11px] text-stone-500">
          <ArrowLeft size={14} /> הצעד הבא
        </div>
        <div className="truncate text-sm font-medium">{inst?.title ?? "—"}</div>
        {inst?.date && <div className={cx("text-[11px]", inst.date < today ? "text-rose-600" : "text-stone-500")}>{relativeDayLabel(inst.date, today)}</div>}
      </div>
      {inst && (
        <Button size="icon" variant="ghost" className="h-8 w-8 text-accent-700" aria-label={`סיום: ${inst.title}`} onClick={() => void toggleComplete(inst)}>
          <Check size={16} />
        </Button>
      )}
    </div>
  );
}

function MilestoneRow({ m, index, goalColor, onEdit, onAddTask }: { m: Milestone; index: number; goalColor: string; onEdit: () => void; onAddTask: () => void }) {
  const db = useStore((s) => s.db);
  const put = useStore((s) => s.put);
  const [open, setOpen] = useState(false);
  const comp = milestoneCompletion(db, m.id);
  const mTasks = Object.values(db.tasks).filter((t) => t.milestoneId === m.id && !t.recurrence);
  return (
    <li className="relative">
      <span className={cx("absolute -start-[25px] top-3 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold", m.status === "done" ? "bg-accent-600 text-white" : m.status === "active" ? "bg-white ring-2 ring-accent-500 dark:bg-stone-900" : "bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-200")}>
        {m.status === "done" ? <Check size={10} /> : index + 1}
      </span>
      <button className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-start hover:bg-stone-50 dark:hover:bg-white/[0.03]" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="min-w-0 flex-1">
          <div className={cx("truncate text-sm font-medium", m.status === "done" && "text-stone-400 line-through")}>{m.title}</div>
          <div className="text-[11px] text-stone-500">{m.targetDate ? formatHebDate(m.targetDate, { year: true }) : "ללא תאריך"}</div>
        </div>
        {comp.total > 0 && (
          <div className="w-16 shrink-0">
            <ProgressBar value={comp.done / comp.total} className="h-1.5" barClass={goalColor} label={m.title} />
            <div className="mt-0.5 text-center text-[10px] text-stone-500">
              {comp.done}/{comp.total}
            </div>
          </div>
        )}
        <ChevronDown size={16} className={cx("shrink-0 text-stone-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="animate-in mb-2 ms-2 space-y-2 border-s hairline ps-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select className="w-auto py-1 text-xs" value={m.status} aria-label="סטטוס אבן דרך" onChange={(e) => void put("milestones", { ...m, status: e.target.value as Milestone["status"], updatedAt: nowIso() })}>
              <option value="pending">ממתינה</option>
              <option value="active">בעבודה</option>
              <option value="done">הושלמה</option>
            </Select>
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Pencil size={13} /> עריכה
            </Button>
            <Button size="sm" variant="ghost" onClick={onAddTask}>
              <Plus size={13} /> משימה
            </Button>
          </div>
          {m.description && <p className="text-xs text-stone-500">{m.description}</p>}
          <div className="-mx-2">
            {mTasks.map((t) => (
              <TaskRow key={t.id} inst={singleInstance(t)} showDate compact />
            ))}
          </div>
        </div>
      )}
    </li>
  );
}

function WeekPlan({ upcoming, today }: { upcoming: TaskInstance[]; today: string }) {
  const ws = startOfWeek(today);
  const weeks = [0, 1, 2, 3].map((i) => addDays(ws, i * 7));
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {weeks.map((w) => {
        const items = upcoming.filter((i) => i.date! >= w && i.date! <= addDays(w, 6) && !i.task.id.startsWith("rv:"));
        return (
          <div key={w} className={cx("rounded-xl border hairline p-2.5", w === ws && "border-accent-300 dark:border-accent-700")}>
            <div className="mb-1 flex justify-between text-[11px] text-stone-500">
              <span className="font-semibold">{w === ws ? "השבוע" : formatHebDate(w)}</span>
              <span>{formatDuration(items.reduce((s, i) => s + (i.task.estimatedMinutes ?? 0), 0)) || "—"}</span>
            </div>
            {items.length === 0 ? (
              <p className="text-xs text-stone-400">—</p>
            ) : (
              <ul className="space-y-0.5 text-xs">
                {items.slice(0, 6).map((i) => (
                  <li key={i.key} className={cx("flex gap-1.5 truncate", !isOpen(i.status) && "text-stone-400 line-through")}>
                    {i.recurring && <Repeat size={11} className="mt-0.5 shrink-0 text-stone-400" />}
                    {i.title}
                  </li>
                ))}
                {items.length > 6 && <li className="text-stone-400">+{items.length - 6}</li>}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Kind-specific measurement & trackers. */
function ProgressSection({ goalId }: { goalId: string }) {
  const db = useStore((s) => s.db);
  const goal = db.goals[goalId];
  const weights = Object.values(db.weightLogs).sort((a, b) => (a.date < b.date ? -1 : 1));
  const motoInfo = goal.kind === "motorcycle" ? motorcycleCost((goal.info ?? {}) as Partial<MotorcycleInfo>) : null;
  return (
    <div className="space-y-4">
      {goal.kind === "weight" && (
        <>
          <WeightStart goal={goal} />
          <WeightLogger />
          {weights.length >= 2 && <LineChart ariaLabel="היסטוריית משקל" series={[{ label: "משקל", color: "var(--series-1)", points: weights.map((w) => ({ x: w.date, y: w.kg })) }]} format={(v) => `${v}`} />}
          <Details label="על התוצאה">אין הבטחה לתוצאה. לשינויי תזונה משמעותיים כדאי להתייעץ עם איש מקצוע.</Details>
        </>
      )}
      {goal.kind === "portfolio" && goal.financeAccountId && (
        <>
          <FinanceSummary accountId={goal.financeAccountId} target={goal.targetValue} />
          <PortfolioScenarios accountId={goal.financeAccountId} target={goal.targetValue ?? 30000} deadline={goal.targetDate} />
          <FinanceEntries accountId={goal.financeAccountId} portfolio />
        </>
      )}
      {goal.kind === "motorcycle" && (
        <>
          {goal.financeAccountId && <FinanceSummary accountId={goal.financeAccountId} target={motoInfo?.upfront || null} />}
          {goal.financeAccountId && <FinanceEntries accountId={goal.financeAccountId} />}
          <Disclosure id={`g-${goalId}-moto`} title="פרטי הרכישה" summary={motoInfo?.missing.length ? `חסר: ${motoInfo.missing.length}` : "מלא"}>
            <MotorcycleInfoForm goal={goal} />
          </Disclosure>
        </>
      )}
      {goal.kind === "purchase" && goal.financeAccountId && (
        <>
          <FinanceSummary accountId={goal.financeAccountId} target={goal.targetValue} />
          <FinanceEntries accountId={goal.financeAccountId} />
        </>
      )}
      {(goal.kind === "income" || goal.kind === "learning" || goal.kind === "custom") &&
        (goal.targetValue != null ? <ProgressRecorder goalId={goalId} /> : <p className="text-sm text-stone-500">אין מדד מספרי — ההתקדמות נמדדת באבני הדרך.</p>)}
    </div>
  );
}

function ProgressRecorder({ goalId }: { goalId: string }) {
  const db = useStore((s) => s.db);
  const put = useStore((s) => s.put);
  const today = useToday();
  const goal = db.goals[goalId];
  const [v, setV] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const recs = Object.values(db.progressRecords).filter((r) => r.goalId === goalId).sort((a, b) => (a.date < b.date ? -1 : 1));
  return (
    <div className="mt-4 border-t hairline pt-3">
      <div className="mb-2 text-sm font-medium">עדכון המדד ({goal.unit || "ערך"})</div>
      <div className="flex flex-wrap items-end gap-2">
        <Input className="w-32" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} aria-label="ערך נוכחי" placeholder="ערך נוכחי" />
        <Button
          size="sm"
          variant="primary"
          onClick={async () => {
            const n = Number(v.replace(/[,₪\s]/g, ""));
            if (!v || !Number.isFinite(n)) return setErr("נא להזין מספר");
            setErr(null);
            const ts = nowIso();
            if (await put("progressRecords", { id: uid(), goalId, metricKey: "main", date: today, value: n, note: "", createdAt: ts, updatedAt: ts })) setV("");
          }}
        >
          רישום
        </Button>
        {err && <span className="text-xs text-rose-600">{err}</span>}
      </div>
      {recs.length >= 2 && (
        <div className="mt-3">
          <LineChart ariaLabel="היסטוריית המדד" series={[{ label: goal.unit || "ערך", color: "var(--series-1)", points: recs.map((r) => ({ x: r.date, y: r.value })) }]} />
        </div>
      )}
      {recs.length > 0 && <p className="mt-1 text-xs text-stone-500">עדכון אחרון: {recs[recs.length - 1].value} ({formatHebDate(recs[recs.length - 1].date)})</p>}
    </div>
  );
}

function ObjList({ title, items }: { title: string; items: Array<{ o: { id: string; status: string }; label: string }> }) {
  const db = useStore((s) => s.db);
  const put = useStore((s) => s.put);
  return (
    <div className="rounded-xl bg-stone-50 p-2.5 dark:bg-white/[0.03]">
      <div className="mb-1 text-xs font-semibold text-stone-500">{title}</div>
      <ul className="space-y-1">
        {items.map(({ o, label }) => (
          <li key={o.id}>
            <label className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                className="mt-0.5 accent-accent-600"
                checked={o.status === "done"}
                onChange={(e) => {
                  const cur = db.objectives[o.id];
                  if (cur) void put("objectives", { ...cur, status: e.target.checked ? "done" : "pending", updatedAt: nowIso() });
                }}
              />
              <span className={cx(o.status === "done" && "line-through text-stone-400")}>{label}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MilestoneForm({ m, onClose }: { m: Milestone; onClose: () => void }) {
  const put = useStore((s) => s.put);
  const exists = useStore((s) => !!s.db.milestones[m.id]);
  const [f, setF] = useState(m);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal
      open
      onClose={onClose}
      title={exists ? "עריכת אבן דרך" : "אבן דרך חדשה"}
      footer={
        <>
          {exists && (
            <Button
              variant="ghost"
              className="me-auto text-rose-600"
              onClick={async () => {
                if (await confirmDialog({ title: "למחוק את אבן הדרך?", message: "המשימות שלה יישארו במטרה, ללא אבן דרך.", danger: true, confirmLabel: "מחיקה" })) {
                  await deleteMilestone(m.id);
                  onClose();
                }
              }}
            >
              מחיקה
            </Button>
          )}
          <Button onClick={onClose}>ביטול</Button>
          <Button
            variant="primary"
            onClick={async () => {
              if (f.title.trim().length < 2) return setErr("כותרת קצרה מדי");
              if (await put("milestones", { ...f, title: f.title.trim(), updatedAt: nowIso() })) onClose();
            }}
          >
            שמירה
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="כותרת" error={err}>
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <Field label="תאריך יעד">
          <Input type="date" value={f.targetDate ?? ""} onChange={(e) => setF({ ...f, targetDate: e.target.value || null })} />
        </Field>
        <Field label="תיאור">
          <Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
