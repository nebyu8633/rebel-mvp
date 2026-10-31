"use client";
import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Pencil, Trash2, Sparkles, Plus, Flag } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useUI } from "@/lib/store/ui";
import { useToday } from "@/hooks/useToday";
import { goalColor, goalProgress, milestoneCompletion, GOAL_STATUS } from "@/lib/goals";
import { formatHebDate, MONTHS_HE, parseDate } from "@/lib/dates";
import { singleInstance, instancesInRange } from "@/lib/tasks";
import { deleteGoal, deleteMilestone, nowIso, uid } from "@/lib/actions";
import { motorcycleCost } from "@/lib/finance";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, ProgressBar, SectionTitle, Select, confirmDialog, cx } from "@/components/ui";
import { TaskRow } from "@/components/TaskRow";
import { GoalForm, MotorcycleInfoForm, WeightLogger, WeightStart } from "@/components/GoalForms";
import { FinanceEntries, FinanceSummary, PortfolioScenarios } from "@/components/FinancePanel";
import { LineChart } from "@/components/charts";
import type { Milestone, MotorcycleInfo } from "@/lib/types";

export default function GoalDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const db = useStore((s) => s.db);
  const put = useStore((s) => s.put);
  const today = useToday();
  const router = useRouter();
  const openEditor = useUI((s) => s.openEditor);
  const [editing, setEditing] = useState(false);
  const [msEdit, setMsEdit] = useState<Milestone | null>(null);
  const goal = db.goals[id];

  if (!goal)
    return (
      <EmptyState title="המטרה לא נמצאה" action={<Link href="/goals" className="text-accent-700">חזרה למטרות</Link>}>
        ייתכן שנמחקה.
      </EmptyState>
    );

  const p = goalProgress(db, goal, today);
  const c = goalColor(goal.color);
  const milestones = Object.values(db.milestones)
    .filter((m) => m.goalId === id)
    .sort((a, b) => a.order - b.order);
  const objectives = Object.values(db.objectives).filter((o) => o.goalId === id);
  const tasks = Object.values(db.tasks).filter((t) => t.goalId === id);
  const unassigned = tasks.filter((t) => !t.milestoneId && !t.recurrence);
  const routines = tasks.filter((t) => t.recurrence);
  const motoInfo = goal.kind === "motorcycle" ? motorcycleCost((goal.info ?? {}) as Partial<MotorcycleInfo>) : null;
  const plannerBlocked = goal.kind === "motorcycle" && motoInfo && (!((goal.info as MotorcycleInfo).model) || (goal.info as MotorcycleInfo).price == null);
  const weights = Object.values(db.weightLogs).sort((a, b) => (a.date < b.date ? -1 : 1));

  return (
    <div className="space-y-5">
      <Link href="/goals" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
        <ArrowRight size={14} /> המטרות שלי
      </Link>
      <PageHeader
        title={goal.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={GOAL_STATUS[goal.status].tone}>{GOAL_STATUS[goal.status].label}</Badge>
            {formatHebDate(goal.startDate, { year: true })} ← {formatHebDate(goal.targetDate, { year: true })}
            {!goal.startConfirmed && <span className="text-amber-700">(תאריך התחלה לא אושר — ערכו כדי לאשר)</span>}
          </span>
        }
        actions={
          <>
            <Button size="sm" onClick={() => setEditing(true)}>
              <Pencil size={14} /> עריכה
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-rose-600"
              onClick={async () => {
                if (await confirmDialog({ title: "למחוק את המטרה?", message: "אבני הדרך והיעדים יימחקו. המשימות יישארו, ללא שיוך למטרה.", danger: true, confirmLabel: "מחיקה" })) {
                  if (await deleteGoal(id)) router.push("/goals");
                }
              }}
            >
              <Trash2 size={14} /> מחיקה
            </Button>
          </>
        }
      />

      <Card>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm text-stone-500">התקדמות</span>
          <span className="text-sm font-semibold">{p.fraction != null ? `${Math.round(p.fraction * 100)}%` : "—"}</span>
        </div>
        <ProgressBar value={p.fraction} barClass={c.bar} label="התקדמות" />
        <p className="mt-2 text-xs text-stone-500">
          עברו {Math.round(p.timeElapsed * 100)}% מהזמן.
          {p.missing.length > 0 && ` כדי לחשב התקדמות חסר: ${p.missing.join(", ")}.`}
        </p>
        {goal.why && <p className="mt-2 text-sm">{goal.why}</p>}
      </Card>

      {goal.kind === "motorcycle" && (
        <>
          <Card>
            <SectionTitle hint="אבני הדרך נבנות רק אחרי שהמידע הזה קיים">פרטי הרכישה</SectionTitle>
            <MotorcycleInfoForm goal={goal} />
          </Card>
          {goal.financeAccountId && (
            <Card>
              <SectionTitle hint="נפרד מתיק ההשקעות">חיסכון לאופנוע</SectionTitle>
              <FinanceSummary accountId={goal.financeAccountId} target={motoInfo?.upfront || null} />
              <div className="mt-4">
                <FinanceEntries accountId={goal.financeAccountId} />
              </div>
            </Card>
          )}
        </>
      )}

      {goal.kind === "weight" && (
        <Card>
          <SectionTitle hint="אין כאן הבטחה לתוצאה. לשינויי תזונה משמעותיים — כדאי להתייעץ עם איש מקצוע.">משקל</SectionTitle>
          <WeightStart goal={goal} />
          <div className="mt-4">
            <WeightLogger />
          </div>
          {weights.length >= 2 && (
            <div className="mt-4">
              <LineChart ariaLabel="היסטוריית משקל" series={[{ label: "משקל", color: "var(--series-1)", points: weights.map((w) => ({ x: w.date, y: w.kg })) }]} format={(v) => `${v}`} />
            </div>
          )}
        </Card>
      )}

      {goal.kind === "portfolio" && goal.financeAccountId && (
        <Card>
          <SectionTitle hint="שווי שוק לפי הדיווח שלך — ללא חיבור לחשבון וללא ביצוע פעולות">תיק השקעות</SectionTitle>
          <FinanceSummary accountId={goal.financeAccountId} target={goal.targetValue} />
          <div className="mt-4">
            <PortfolioScenarios accountId={goal.financeAccountId} target={goal.targetValue ?? 30000} deadline={goal.targetDate} />
          </div>
          <div className="mt-4">
            <FinanceEntries accountId={goal.financeAccountId} portfolio />
          </div>
        </Card>
      )}

      {goal.kind === "custom" && goal.startValue != null && goal.targetValue != null && (
        <Card>
          <SectionTitle>עדכון ערך נוכחי</SectionTitle>
          <div className="flex items-end gap-2">
            <Field label={`ערך נוכחי ${goal.unit ? `(${goal.unit})` : ""}`} className="w-40">
              <Input
                inputMode="decimal"
                defaultValue={goal.manualValue ?? ""}
                onBlur={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  if (v === null || !Number.isNaN(v)) void put("goals", { ...goal, manualValue: v, updatedAt: nowIso() });
                }}
              />
            </Field>
            <span className="pb-2 text-sm text-stone-500">
              מ-{goal.startValue} אל {goal.targetValue}
            </span>
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setMsEdit({ id: uid(), goalId: id, title: "", description: "", targetDate: null, status: "pending", order: milestones.length, createdAt: nowIso(), updatedAt: nowIso() })}>
                <Plus size={14} /> ידני
              </Button>
              {plannerBlocked ? (
                <Button size="sm" disabled title="יש למלא דגם ומחיר קודם">
                  <Sparkles size={14} /> תכנון
                </Button>
              ) : (
                <Link href={`/goals/plan?goal=${id}`}>
                  <Button size="sm" variant="primary">
                    <Sparkles size={14} /> {milestones.length ? "תכנון נוסף" : "פירוק לתוכנית"}
                  </Button>
                </Link>
              )}
            </div>
          }
          hint={plannerBlocked ? "מלאו דגם, מחיר ופרטי חיסכון כדי לבנות אבני דרך" : undefined}
        >
          אבני דרך
        </SectionTitle>
        {milestones.length === 0 ? (
          <EmptyState icon={<Flag size={24} />} title="עדיין אין אבני דרך">
            המתכנן יציע פירוק שתוכלו לבדוק, לערוך ולאשר לפני שמשהו נכנס ללוח.
          </EmptyState>
        ) : (
          <ol className="space-y-4">
            {milestones.map((m, idx) => {
              const comp = milestoneCompletion(db, m.id);
              const mTasks = tasks.filter((t) => t.milestoneId === m.id && !t.recurrence);
              const monthObjs = objectives.filter((o) => o.milestoneId === m.id && o.level === "month").sort((a, b) => (a.periodStart < b.periodStart ? -1 : 1));
              const weekObjs = objectives.filter((o) => o.milestoneId === m.id && o.level === "week").sort((a, b) => (a.periodStart < b.periodStart ? -1 : 1));
              return (
                <li key={m.id} className="rounded-2xl border hairline p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cx("flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold", m.status === "done" ? "bg-accent-600 text-white" : "bg-stone-100 dark:bg-white/10")}>{idx + 1}</span>
                        <button className="font-semibold hover:underline" onClick={() => setMsEdit(m)}>
                          {m.title}
                        </button>
                      </div>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {m.targetDate ? `עד ${formatHebDate(m.targetDate, { year: true })}` : "ללא תאריך"} · {comp.done}/{comp.total} משימות
                      </p>
                    </div>
                    <Select
                      className="w-auto py-1 text-sm"
                      value={m.status}
                      aria-label="סטטוס אבן דרך"
                      onChange={(e) => void put("milestones", { ...m, status: e.target.value as Milestone["status"], updatedAt: nowIso() })}
                    >
                      <option value="pending">ממתינה</option>
                      <option value="active">בעבודה</option>
                      <option value="done">הושלמה</option>
                    </Select>
                  </div>
                  {comp.total > 0 && <ProgressBar className="mt-2 h-1.5" value={comp.done / comp.total} barClass={c.bar} label={m.title} />}
                  {(monthObjs.length > 0 || weekObjs.length > 0) && (
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      {monthObjs.length > 0 && (
                        <ObjList
                          title="יעדים חודשיים"
                          items={monthObjs.map((o) => ({ o, label: `${MONTHS_HE[parseDate(o.periodStart).getUTCMonth()]}: ${o.title}` }))}
                        />
                      )}
                      {weekObjs.length > 0 && <ObjList title="יעדים שבועיים" items={weekObjs.map((o) => ({ o, label: `שבוע ${formatHebDate(o.periodStart)}: ${o.title}` }))} />}
                    </div>
                  )}
                  <div className="-mx-2 mt-2">
                    {mTasks.map((t) => (
                      <TaskRow key={t.id} inst={singleInstance(t)} showDate compact showWhy />
                    ))}
                  </div>
                  <Button size="sm" variant="ghost" className="mt-1" onClick={() => openEditor({ defaults: { goalId: id, milestoneId: m.id, date: null } })}>
                    <Plus size={14} /> משימה לאבן הדרך
                  </Button>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      {(unassigned.length > 0 || routines.length > 0) && (
        <Card>
          <SectionTitle
            action={
              <Button size="sm" variant="ghost" onClick={() => openEditor({ defaults: { goalId: id } })}>
                <Plus size={14} />
              </Button>
            }
          >
            משימות ושגרות נוספות
          </SectionTitle>
          <div className="-mx-2">
            {unassigned.map((t) => (
              <TaskRow key={t.id} inst={singleInstance(t)} showDate compact />
            ))}
            {routines.map((t) => {
              const next = instancesInRange(db, today, today, today).find((i) => i.task.id === t.id);
              return next ? <TaskRow key={t.id} inst={next} compact /> : (
                <button key={t.id} className="block w-full px-2 py-2 text-start text-sm text-stone-600" onClick={() => openEditor({ task: t })}>
                  ↻ {t.title}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {editing && <GoalForm goal={goal} onClose={() => setEditing(false)} />}
      {msEdit && <MilestoneForm m={msEdit} onClose={() => setMsEdit(null)} />}
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
