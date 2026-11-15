"use client";
import { useState } from "react";
import { Plus, Pause, Play, Pencil, Repeat } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useToday } from "@/hooks/useToday";
import { Habit } from "@/lib/types";
import { addDays, startOfWeek, WEEKDAYS_HE, WEEKDAYS_SHORT_HE, weekday, formatHebDate } from "@/lib/dates";
import { habitDueOn } from "@/lib/tasks";
import { describeFrequency, recentDone, weekCompletion } from "@/lib/habits";
import { deleteHabit, nowIso, setHabitLog, uid } from "@/lib/actions";
import { Button, Card, Details, EmptyState, Field, Input, Modal, PageHeader, Select, confirmDialog, cx } from "@/components/ui";

export default function HabitsPage() {
  const db = useStore((s) => s.db);
  const put = useStore((s) => s.put);
  const today = useToday();
  const [editing, setEditing] = useState<Habit | null>(null);
  const habits = Object.values(db.habits).sort((a, b) => a.order - b.order);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const ws = startOfWeek(today);

  const blank = (): Habit => ({ id: uid(), title: "", goalId: null, frequency: { type: "daily" }, startDate: today, paused: false, reminderTime: null, order: habits.length, createdAt: nowIso(), updatedAt: nowIso() });

  return (
    <div>
      <PageHeader
        title="הרגלים"
        actions={
          <Button variant="primary" onClick={() => setEditing(blank())}>
            <Plus size={16} /> הרגל חדש
          </Button>
        }
      />
      {habits.length === 0 ? (
        <EmptyState icon={<Repeat size={28} />} title="עדיין אין הרגלים" action={<Button variant="primary" onClick={() => setEditing(blank())}>הוספת הרגל</Button>}>
          למשל: שקילה שבועית, אימון כוח 3 פעמים בשבוע, ארוחת בוקר.
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-panel border border-line bg-surface">
          {habits.map((h) => {
            const wc = weekCompletion(h, db.habitLogs, ws, today);
            const month = recentDone(h, db.habitLogs, today);
            const goal = h.goalId ? db.goals[h.goalId] : null;
            return (
              <div key={h.id} className={cx("border-b border-line px-4 py-3 last:border-b-0", h.paused && "opacity-60")}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-body font-medium text-ink">{h.title}</div>
                    <div className="text-footnote text-ink-2">
                      {describeFrequency(h)}
                      {h.reminderTime && ` · תזכורת ${h.reminderTime}`}
                      {goal && ` · ${goal.title}`}
                      {h.paused && " · מושהה"}
                    </div>
                  </div>
                  <div className="flex">
                    <Button size="icon" variant="ghost" aria-label={h.paused ? `חידוש: ${h.title}` : `השהיה: ${h.title}`} onClick={() => void put("habits", { ...h, paused: !h.paused, updatedAt: nowIso() })}>
                      {h.paused ? <Play size={16} /> : <Pause size={16} />}
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={`עריכה: ${h.title}`} onClick={() => setEditing(h)}>
                      <Pencil size={16} />
                    </Button>
                  </div>
                  <div className="flex w-full items-center justify-between gap-1 sm:w-auto" role="group" aria-label={`7 הימים האחרונים: ${h.title}`}>
                    {days.map((d) => {
                      const log = db.habitLogs[`${h.id}:${d}`];
                      const due = habitDueOn(h, d) || !!log;
                      const next = !log ? "done" : log.status === "done" ? "skipped" : null;
                      return (
                        <button
                          key={d}
                          disabled={h.paused && !log}
                          onClick={() => void setHabitLog(h, d, next)}
                          title={`${formatHebDate(d, { weekday: true })}: ${!log ? "לא סומן" : log.status === "done" ? "בוצע" : "דילוג"} (לחיצה: ${next === "done" ? "בוצע" : next === "skipped" ? "דילוג" : "ניקוי"})`}
                          aria-label={`${WEEKDAYS_HE[weekday(d)]} ${formatHebDate(d)}: ${!log ? "לא סומן" : log.status === "done" ? "בוצע" : "דילוג"}`}
                          className={cx(
                            "flex h-10 w-10 flex-col items-center justify-center rounded-field text-caption transition-colors",
                            log?.status === "done" ? "bg-accent text-white dark:text-[#06201c]" : log?.status === "skipped" ? "bg-surface-2 text-ink-3" : due ? "border border-line text-ink-2" : "text-ink-3/60",
                            d === today && "ring-2 ring-accent/40",
                          )}
                        >
                          {WEEKDAYS_SHORT_HE[weekday(d)]}
                        </button>
                      );
                    })}
                  </div>
                  <div className="tnum w-full text-footnote text-ink-2 sm:w-28">
                    השבוע {wc.done} מתוך {wc.due}
                    {month > 0 && <span className="text-ink-3"> · {month} בחודש האחרון</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {habits.length > 0 && (
        <Details className="mt-3" label="איך מסמנים">לחיצה על יום: בוצע ← דילוג ← ניקוי. דילוג הוא בסדר — הוא לא נספר כהחמצה.</Details>
      )}
      {editing && <HabitForm habit={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function HabitForm({ habit, onClose }: { habit: Habit; onClose: () => void }) {
  const db = useStore((s) => s.db);
  const put = useStore((s) => s.put);
  const exists = !!db.habits[habit.id];
  const [f, setF] = useState(habit);
  const [err, setErr] = useState<string | null>(null);
  const type = f.frequency.type;
  async function save() {
    const r = Habit.safeParse({ ...f, title: f.title.trim(), updatedAt: nowIso() });
    if (!r.success) return setErr(r.error.issues[0]?.message ?? "שגיאה");
    if (await put("habits", r.data)) onClose();
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={exists ? "עריכת הרגל" : "הרגל חדש"}
      footer={
        <>
          {exists && (
            <Button
              variant="ghost"
              className="me-auto text-rose-600"
              onClick={async () => {
                if (await confirmDialog({ title: "למחוק את ההרגל?", message: "ההיסטוריה שלו תימחק. אפשר במקום זאת להשהות.", danger: true, confirmLabel: "מחיקה" })) {
                  if (await deleteHabit(f.id)) onClose();
                }
              }}
            >
              מחיקה
            </Button>
          )}
          <Button onClick={onClose}>ביטול</Button>
          <Button variant="primary" onClick={save}>
            שמירה
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="שם ההרגל" error={err}>
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <Field label="תדירות">
          <Select
            value={type}
            onChange={(e) => {
              const t = e.target.value;
              setF({ ...f, frequency: t === "daily" ? { type: "daily" } : t === "weekdays" ? { type: "weekdays", days: [0, 2, 4] } : { type: "times_per_week", count: 3 } });
            }}
          >
            <option value="daily">כל יום</option>
            <option value="weekdays">ימים קבועים</option>
            <option value="times_per_week">X פעמים בשבוע (גמיש)</option>
          </Select>
        </Field>
        {f.frequency.type === "weekdays" && (
          <div className="flex gap-1.5">
            {WEEKDAYS_SHORT_HE.map((d, i) => {
              const days = (f.frequency as { days: number[] }).days;
              const on = days.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={on}
                  aria-label={WEEKDAYS_HE[i]}
                  onClick={() => {
                    const next = on ? days.filter((x) => x !== i) : [...days, i].sort();
                    if (next.length) setF({ ...f, frequency: { type: "weekdays", days: next } });
                  }}
                  className={cx("h-9 w-9 rounded-full text-sm", on ? "bg-accent-600 text-white" : "surface border")}
                >
                  {d}
                </button>
              );
            })}
          </div>
        )}
        {f.frequency.type === "times_per_week" && (
          <Field label="כמה פעמים בשבוע">
            <Input type="number" min={1} max={7} value={f.frequency.count} onChange={(e) => setF({ ...f, frequency: { type: "times_per_week", count: Math.min(7, Math.max(1, Number(e.target.value) || 1)) } })} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="תזכורת (רשות)">
            <Input type="time" value={f.reminderTime ?? ""} onChange={(e) => setF({ ...f, reminderTime: e.target.value || null })} />
          </Field>
          <Field label="מטרה">
            <Select value={f.goalId ?? ""} onChange={(e) => setF({ ...f, goalId: e.target.value || null })}>
              <option value="">ללא</option>
              {Object.values(db.goals).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}
