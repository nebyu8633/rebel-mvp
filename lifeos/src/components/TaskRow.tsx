"use client";
import { useState } from "react";
import { Check, CalendarClock, Repeat, AlertCircle, MoreHorizontal, Lock, Bell } from "lucide-react";
import type { TaskInstance } from "@/lib/tasks";
import { blockingDependencies } from "@/lib/tasks";
import { useStore } from "@/lib/store/store";
import { useUI } from "@/lib/store/ui";
import { setInstanceStatus, toggleComplete, rescheduleInstance } from "@/lib/actions";
import { formatDuration, relativeDayLabel, addDays, startOfWeek, formatHebDate } from "@/lib/dates";
import { goalColor } from "@/lib/goals";
import { useToday } from "@/hooks/useToday";
import { Badge, Button, Field, Input, Modal, cx } from "./ui";
import { STATUS_LABELS } from "./TaskEditor";

const ROUTINE_LABEL = { grocery: "קניות", meal_prep: "הכנת אוכל", weekly_review: "סיכום שבועי" } as const;

export function TaskRow({
  inst,
  showDate,
  showWhy,
  compact,
}: {
  inst: TaskInstance;
  showDate?: boolean;
  showWhy?: boolean;
  compact?: boolean;
}) {
  const db = useStore((s) => s.db);
  const today = useToday();
  const openEditor = useUI((s) => s.openEditor);
  const openReschedule = useUI((s) => s.openReschedule);
  const [menu, setMenu] = useState(false);
  const t = inst.task;
  const goal = t.goalId ? db.goals[t.goalId] : null;
  const done = inst.status === "completed";
  const skipped = inst.status === "skipped";
  const overdue = !!inst.date && inst.date < today && !done && !skipped;
  const blockers = blockingDependencies(db, t);
  const c = goal ? goalColor(goal.color) : null;

  return (
    <div className={cx("group relative flex min-h-[52px] items-center gap-2 px-2 transition-colors", (done || skipped) && "opacity-55")}>
      {/* 44×44 hit area around a 22px circle */}
      <button
        type="button"
        onClick={() => void toggleComplete(inst)}
        aria-label={done ? `סמן כלא הושלם: ${inst.title}` : `סמן כהושלם: ${inst.title}`}
        aria-pressed={done}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span
          className={cx(
            "grid h-[22px] w-[22px] place-items-center rounded-full border-[1.5px] transition-colors",
            done ? "border-accent bg-accent text-white dark:text-[#06201c]" : t.priority === "high" ? "border-warn" : "border-line-strong group-hover:border-accent",
          )}
        >
          {done && <Check size={14} strokeWidth={3} />}
        </span>
      </button>

      <button type="button" className="min-w-0 flex-1 py-2.5 text-start" onClick={() => openEditor({ instance: inst })}>
        <div className={cx("text-body text-ink", done && "text-ink-3 line-through decoration-ink-3/50")}>{inst.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-footnote text-ink-2 empty:hidden">
          {showDate && inst.date && (
            <span className={cx(overdue && "font-medium text-warn")}>{relativeDayLabel(inst.date, today)}</span>
          )}
          {!showDate && overdue && <span className="font-medium text-warn">מ{relativeDayLabel(inst.date!, today)}</span>}
          {inst.startTime && <span className="tnum font-medium text-ink">{inst.startTime}</span>}
          {t.estimatedMinutes ? <span>{formatDuration(t.estimatedMinutes)}</span> : null}
          {inst.recurring && (
            <span className="inline-flex items-center gap-0.5" title="משימה חוזרת">
              <Repeat size={12} />
              {t.routine ? ROUTINE_LABEL[t.routine] : null}
            </span>
          )}
          {inst.movedToBackup && <Badge tone="amber">הועבר ליום הגיבוי</Badge>}
          {((t.reminderMinutes != null && inst.startTime) || Object.values(db.reminders).some((r) => r.taskId === t.id && r.enabled)) && <Bell size={12} className="text-ink-3" aria-label="יש תזכורת" />}
          {goal && !compact && (
            <span className="inline-flex min-w-0 items-center gap-1 text-ink-3">
              <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", c!.dot)} />
              {goal.title}
            </span>
          )}
          {t.deadline && !done && (
            <span className={cx("inline-flex items-center gap-0.5", t.deadline <= addDays(today, 3) ? "text-warn" : "")}>
              <AlertCircle size={12} /> עד {formatHebDate(t.deadline)}
            </span>
          )}
          {blockers.length > 0 && !done && (
            <span className="inline-flex items-center gap-0.5 text-ink-3">
              <Lock size={12} /> ממתינה ל{blockers[0].title}
            </span>
          )}
          {inst.status === "in_progress" && <Badge tone="sky">בתהליך</Badge>}
          {skipped && <Badge>דילגתי</Badge>}
        </div>
        {showWhy && t.rationale && !done && <p className="mt-1 text-footnote leading-relaxed text-ink-3">{t.rationale}</p>}
      </button>

      <div className="relative shrink-0">
        <Button variant="ghost" size="icon" aria-label={`פעולות: ${inst.title}`} aria-expanded={menu} onClick={() => setMenu((m) => !m)} className="text-ink-3">
          <MoreHorizontal size={18} />
        </Button>
        {menu && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
            <div className="animate-in absolute end-0 top-11 z-40 w-52 overflow-hidden rounded-panel border border-line bg-surface py-1 text-body shadow-float sm:top-9" role="menu">
              {[
                { label: "דחייה / תזמון מחדש", run: () => openReschedule(inst), icon: <CalendarClock size={14} /> },
                ...(inst.date !== today ? [{ label: "להעביר להיום", run: () => void rescheduleInstance(inst, today) }] : []),
                { label: "למחר", run: () => void rescheduleInstance(inst, addDays(today, 1)) },
                ...(inst.status !== "in_progress" && !done ? [{ label: STATUS_LABELS.in_progress, run: () => void setInstanceStatus(inst, "in_progress") }] : []),
                ...(!skipped ? [{ label: "דלג הפעם", run: () => void setInstanceStatus(inst, "skipped") }] : [{ label: "בטל דילוג", run: () => void setInstanceStatus(inst, "planned") }]),
                { label: "עריכה", run: () => openEditor({ instance: inst }) },
              ].map((a) => (
                <button
                  key={a.label}
                  role="menuitem"
                  className="flex min-h-11 w-full items-center gap-2 px-3 text-start text-ink hover:bg-surface-2 sm:min-h-9"
                  onClick={() => {
                    setMenu(false);
                    a.run();
                  }}
                >
                  {a.icon}
                  {a.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function RescheduleHost() {
  const inst = useUI((s) => s.reschedule);
  const close = () => useUI.getState().openReschedule(null);
  const today = useToday();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  if (!inst) return null;
  const nextWeek = addDays(startOfWeek(today), 7);
  const go = async (d: string | null, t?: string | null) => {
    if (await rescheduleInstance(inst, d, t)) close();
  };
  return (
    <Modal open onClose={close} title={`תזמון מחדש: ${inst.title}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => go(today)}>היום</Button>
          <Button onClick={() => go(addDays(today, 1))}>מחר</Button>
          <Button onClick={() => go(addDays(today, 2))}>מחרתיים</Button>
          <Button onClick={() => go(nextWeek)}>שבוע הבא</Button>
          {!inst.recurring && (
            <Button className="col-span-2" variant="subtle" onClick={() => go(null)}>
              ללא תאריך (נדחה)
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="תאריך אחר">
            <Input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="שעה (רשות)">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        {inst.recurring && <p className="text-xs text-stone-500">ישפיע רק על המופע הזה. לשינוי הסדרה כולה — עריכה ← ״כל הסדרה״.</p>}
        <Button variant="primary" className="w-full" disabled={!date} onClick={() => go(date, time || undefined)}>
          העברה
        </Button>
      </div>
    </Modal>
  );
}
