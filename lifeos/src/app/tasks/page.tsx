"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search, Repeat, Inbox } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useUI } from "@/lib/store/ui";
import { useToday } from "@/hooks/useToday";
import { addDays, formatHebDate, relativeDayLabel } from "@/lib/dates";
import { instancesInRange, isOpen, overdueInstances, singleInstance, unscheduledTasks, type TaskInstance } from "@/lib/tasks";
import { describeRule, nextOccurrence } from "@/lib/recurrence";
import { saveTask } from "@/lib/actions";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Segmented, Select, Toggle } from "@/components/ui";
import { TaskRow } from "@/components/TaskRow";
import { RecoveryModal } from "@/components/RecoveryModal";

type View = "upcoming" | "overdue" | "inbox" | "recurring" | "done";

export default function TasksPage() {
  return (
    <Suspense>
      <Tasks />
    </Suspense>
  );
}

function Tasks() {
  const params = useSearchParams();
  const db = useStore((s) => s.db);
  const today = useToday();
  const openEditor = useUI((s) => s.openEditor);
  const [view, setView] = useState<View>((params.get("view") as View) || "upcoming");
  const [q, setQ] = useState("");
  const [goal, setGoal] = useState("");
  const [prio, setPrio] = useState("");
  const [recovery, setRecovery] = useState(false);

  const match = (i: TaskInstance) =>
    (!q || i.title.includes(q) || i.notes.includes(q)) && (!goal || (goal === "none" ? !i.task.goalId : i.task.goalId === goal)) && (!prio || i.task.priority === prio);

  const overdue = useMemo(() => overdueInstances(db, today), [db, today]);
  const upcoming = useMemo(() => instancesInRange(db, today, addDays(today, 30), today), [db, today]);
  const inbox = useMemo(() => unscheduledTasks(db).map(singleInstance), [db]);
  const done = useMemo(
    () =>
      [
        ...Object.values(db.tasks)
          .filter((t) => !t.recurrence && (t.status === "completed" || t.status === "skipped"))
          .map(singleInstance),
        ...instancesInRange(db, addDays(today, -30), today, today).filter((i) => i.recurring && !isOpen(i.status)),
      ].sort((a, b) => ((a.task.completedAt ?? a.date ?? "") < (b.task.completedAt ?? b.date ?? "") ? 1 : -1)),
    [db, today],
  );
  const series = Object.values(db.tasks).filter((t) => t.recurrence);

  const groups = useMemo(() => {
    const g = new Map<string, TaskInstance[]>();
    for (const i of upcoming.filter(match)) {
      const label = i.date === today ? "היום" : i.date === addDays(today, 1) ? "מחר" : i.date! <= addDays(today, 7) ? relativeDayLabel(i.date!, today) : "בהמשך";
      g.set(label, [...(g.get(label) ?? []), i]);
    }
    return [...g.entries()];
  }, [upcoming, today, q, goal, prio]); // eslint-disable-line react-hooks/exhaustive-deps

  const goals = Object.values(db.goals);

  return (
    <div>
      <PageHeader
        title="משימות"
        subtitle="כל המשימות — אותם נתונים כמו בלוח השנה ובדף היום."
        actions={
          <Button variant="primary" onClick={() => openEditor({ defaults: { date: view === "inbox" ? null : today } })}>
            <Plus size={16} /> משימה חדשה
          </Button>
        }
      />
      <div className="mb-4 space-y-3">
        <div className="-mx-1 overflow-x-auto px-1">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "upcoming", label: "קרובות" },
              { value: "overdue", label: `באיחור${overdue.length ? ` (${overdue.length})` : ""}` },
              { value: "inbox", label: `ללא תאריך${inbox.length ? ` (${inbox.length})` : ""}` },
              { value: "recurring", label: "חוזרות" },
              { value: "done", label: "הושלמו" },
            ]}
          />
        </div>
        {view !== "recurring" && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_180px_140px]">
            <div className="relative col-span-2 sm:col-span-1">
              <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <Input className="ps-9" placeholder="חיפוש" value={q} onChange={(e) => setQ(e.target.value)} aria-label="חיפוש משימות" />
            </div>
            <Select value={goal} onChange={(e) => setGoal(e.target.value)} aria-label="סינון לפי מטרה">
              <option value="">כל המטרות</option>
              <option value="none">ללא מטרה</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </Select>
            <Select value={prio} onChange={(e) => setPrio(e.target.value)} aria-label="סינון לפי עדיפות">
              <option value="">כל העדיפויות</option>
              <option value="high">גבוהה</option>
              <option value="medium">בינונית</option>
              <option value="low">נמוכה</option>
            </Select>
          </div>
        )}
      </div>

      {view === "upcoming" &&
        (groups.length === 0 ? (
          <EmptyState title="אין משימות ב-30 הימים הקרובים" />
        ) : (
          <div className="space-y-4">
            {groups.map(([label, list]) => (
              <Card key={label} className="py-3">
                <h3 className="mb-1 text-sm font-semibold text-stone-500">{label}</h3>
                <div className="-mx-2">
                  {list.map((i) => (
                    <TaskRow key={i.key} inst={i} showDate={label === "בהמשך"} />
                  ))}
                </div>
              </Card>
            ))}
          </div>
        ))}

      {view === "overdue" && (
        <Card>
          {overdue.length > 0 && (
            <div className="mb-2 flex justify-end">
              <Button size="sm" variant="subtle" onClick={() => setRecovery(true)}>
                הצעה לסידור מחדש
              </Button>
            </div>
          )}
          {overdue.filter(match).length === 0 ? (
            <EmptyState title="אין משימות באיחור" />
          ) : (
            <div className="-mx-2">
              {overdue.filter(match).map((i) => (
                <TaskRow key={i.key} inst={i} showDate />
              ))}
            </div>
          )}
        </Card>
      )}

      {view === "inbox" && (
        <Card>
          {inbox.filter(match).length === 0 ? (
            <EmptyState icon={<Inbox size={28} />} title="אין משימות ללא תאריך">
              משימות שנדחו ״לזמן לא ידוע״ או נוצרו בלי תאריך יופיעו כאן.
            </EmptyState>
          ) : (
            <div className="-mx-2">
              {inbox.filter(match).map((i) => (
                <TaskRow key={i.key} inst={i} />
              ))}
            </div>
          )}
        </Card>
      )}

      {view === "recurring" && (
        <div className="space-y-3">
          {series.length === 0 && <EmptyState icon={<Repeat size={28} />} title="אין משימות חוזרות" />}
          {series.map((t) => {
            const next = nextOccurrence(t.recurrence!, today);
            return (
              <Card key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                <button className="min-w-0 flex-1 text-start" onClick={() => openEditor({ task: t })}>
                  <div className="flex items-center gap-2 font-medium">
                    {t.title}
                    {t.routine && <Badge tone="accent">שגרה</Badge>}
                  </div>
                  <div className="text-xs text-stone-500">
                    {describeRule(t.recurrence!)}
                    {t.startTime && ` · ${t.startTime}`}
                    {next && !t.recurrence!.paused && ` · הבא: ${formatHebDate(next)}`}
                    {t.recurrence!.missedPolicy === "backup" && t.recurrence!.backupWeekday != null && " · יש יום גיבוי"}
                  </div>
                </button>
                <Toggle
                  checked={!t.recurrence!.paused}
                  onChange={(on) => void saveTask({ ...t, recurrence: { ...t.recurrence!, paused: !on } })}
                  label={<span className="sr-only">פעילה</span>}
                />
              </Card>
            );
          })}
        </div>
      )}

      {view === "done" && (
        <Card>
          {done.filter(match).length === 0 ? (
            <EmptyState title="עדיין אין משימות שהושלמו" />
          ) : (
            <div className="-mx-2">
              {done
                .filter(match)
                .slice(0, 100)
                .map((i) => (
                  <TaskRow key={i.key} inst={i} showDate />
                ))}
            </div>
          )}
        </Card>
      )}
      {recovery && <RecoveryModal open onClose={() => setRecovery(false)} />}
    </div>
  );
}
