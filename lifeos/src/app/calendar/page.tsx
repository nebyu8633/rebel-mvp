"use client";
import { useMemo, useState, type DragEvent } from "react";
import { ChevronRight, ChevronLeft, Plus, Flag, Repeat, AlertTriangle, CalendarPlus, CalendarDays } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useUI } from "@/lib/store/ui";
import { useToday } from "@/hooks/useToday";
import {
  addDays,
  addMonths,
  formatHebDate,
  MONTHS_HE,
  parseDate,
  rangeDays,
  startOfMonth,
  startOfWeek,
  WEEKDAYS_HE,
  WEEKDAYS_SHORT_HE,
  timeToMinutes,
  minutesToTime,
  formatDuration,
} from "@/lib/dates";
import { dayLoad, eventsInRange, findConflicts, habitDueOn, instancesInRange, timedItemsFor, type EventInstance, type TaskInstance } from "@/lib/tasks";
import { instanceFromKey, rescheduleInstance, toggleComplete, nowIso } from "@/lib/actions";
import { goalColor } from "@/lib/goals";
import { Badge, Button, Details, PageHeader, Segmented, cx } from "@/components/ui";
import { EventEditor, blankEvent } from "@/components/EventEditor";
import type { CalendarEvent, Habit } from "@/lib/types";
import { TaskRow } from "@/components/TaskRow";
import { useQuickAdd } from "@/components/QuickAdd";
import { relativeDayLabel } from "@/lib/dates";

type View = "agenda" | "day" | "week" | "month";
const AGENDA_DAYS = 14;

interface DayData {
  tasks: TaskInstance[];
  events: EventInstance[];
  habits: Habit[];
  deadlines: TaskInstance[];
}

export default function CalendarPage() {
  const db = useStore((s) => s.db);
  const put = useStore((s) => s.put);
  const toast = useStore((s) => s.toast);
  const today = useToday();
  const openEditor = useUI((s) => s.openEditor);
  const [view, setView] = useState<View>(() => (typeof window !== "undefined" && window.innerWidth < 640 ? "agenda" : "week"));
  // month view: the tapped day's items are listed under the grid
  const [picked, setPicked] = useState<string | null>(null);
  const [cursor, setCursor] = useState(today);
  const [eventEdit, setEventEdit] = useState<CalendarEvent | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const range = useMemo(() => {
    if (view === "day") return { from: cursor, to: cursor };
    if (view === "agenda") return { from: cursor, to: addDays(cursor, AGENDA_DAYS - 1) };
    if (view === "week") {
      const s = startOfWeek(cursor);
      return { from: s, to: addDays(s, 6) };
    }
    const s = startOfWeek(startOfMonth(cursor));
    const monthEnd = addDays(addMonths(startOfMonth(cursor), 1), -1);
    return { from: s, to: addDays(startOfWeek(monthEnd), 6) };
  }, [view, cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, DayData>();
    for (const d of rangeDays(range.from, range.to)) map.set(d, { tasks: [], events: [], habits: [], deadlines: [] });
    for (const i of instancesInRange(db, range.from, range.to, today)) map.get(i.date!)?.tasks.push(i);
    for (const e of eventsInRange(db, range.from, range.to)) map.get(e.date)?.events.push(e);
    for (const [d, v] of map) v.habits = Object.values(db.habits).filter((h) => habitDueOn(h, d) && h.frequency.type !== "times_per_week");
    for (const t of Object.values(db.tasks))
      if (t.deadline && !t.recurrence && t.status !== "completed" && map.has(t.deadline) && t.deadline !== t.date) {
        const inst = instanceFromKey(db, t.id);
        if (inst) map.get(t.deadline)!.deadlines.push(inst);
      }
    return map;
  }, [db, range, today]);

  const conflicts = useMemo(() => {
    const set = new Set<string>();
    for (const [a, b] of findConflicts(timedItemsFor(db, range.from, range.to))) {
      set.add(a.key);
      set.add(b.key);
    }
    return set;
  }, [db, range]);

  const step = (dir: 1 | -1) => setCursor((c) => (view === "day" ? addDays(c, dir) : view === "week" || view === "agenda" ? addDays(c, 7 * dir) : addMonths(c, dir)));

  async function onDrop(e: DragEvent, date: string, time?: string) {
    e.preventDefault();
    setDragOver(null);
    try {
      const payload = JSON.parse(e.dataTransfer.getData("text/plain")) as { type: "task" | "event"; key: string };
      if (payload.type === "task") {
        const inst = instanceFromKey(db, payload.key);
        if (!inst) return;
        if (await rescheduleInstance(inst, date, time === undefined ? undefined : time)) toast(`הועבר ל${formatHebDate(date)}${time ? ` ${time}` : ""}`, "success");
      } else {
        const ev = db.events[payload.key];
        if (!ev || ev.recurrence) return;
        let patch: Partial<CalendarEvent> = { date };
        if (time && ev.startTime) {
          const dur = ev.endTime ? timeToMinutes(ev.endTime) - timeToMinutes(ev.startTime) : 60;
          patch = { ...patch, startTime: time, endTime: ev.endTime ? minutesToTime(Math.min(timeToMinutes(time) + dur, 23 * 60 + 59)) : null };
        }
        await put("events", { ...ev, ...patch, updatedAt: nowIso() });
      }
    } catch {
      /* not our drag payload */
    }
  }

  const dropProps = (date: string, time?: string) => ({
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      setDragOver(date + (time ?? ""));
    },
    onDragLeave: () => setDragOver(null),
    onDrop: (e: DragEvent) => void onDrop(e, date, time),
  });

  const title =
    view === "month"
      ? `${MONTHS_HE[parseDate(cursor).getUTCMonth()]} ${parseDate(cursor).getUTCFullYear()}`
      : view === "week" || view === "agenda"
        ? `${formatHebDate(range.from)} – ${formatHebDate(range.to, { year: true })}`
        : formatHebDate(cursor, { weekday: true, year: true });

  return (
    <div>
      <PageHeader
        title="לוח שנה"
        actions={
          <>
            <Button size="sm" onClick={() => setEventEdit(blankEvent(view === "day" ? cursor : today))}>
              <CalendarPlus size={16} /> אירוע
            </Button>
            <Button size="sm" variant="primary" onClick={() => openEditor({ defaults: { date: view === "day" ? cursor : today } })}>
              <Plus size={16} /> משימה
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => step(-1)} aria-label="הקודם">
            <ChevronRight size={20} />
          </Button>
          <Button size="sm" variant="subtle" onClick={() => setCursor(today)}>
            היום
          </Button>
          <Button size="icon" variant="ghost" onClick={() => step(1)} aria-label="הבא">
            <ChevronLeft size={20} />
          </Button>
          <h2 className="ms-2 text-base font-semibold">{title}</h2>
        </div>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "agenda", label: "רשימה" },
            { value: "day", label: "יום" },
            { value: "week", label: "שבוע" },
            { value: "month", label: "חודש" },
          ]}
        />
      </div>
      <Legend />

      {view === "month" && (
        <div className="surface overflow-hidden rounded-2xl border">
          <div className="grid grid-cols-7 border-b hairline text-center text-xs font-medium text-stone-500">
            {WEEKDAYS_SHORT_HE.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {[...byDay.entries()].map(([d, data]) => {
              const inMonth = d.slice(0, 7) === cursor.slice(0, 7);
              const items = data.events.length + data.tasks.length;
              return (
                <div
                  key={d}
                  {...dropProps(d)}
                  className={cx(
                    "min-h-20 border-b border-s hairline p-1 sm:min-h-28 sm:p-1.5",
                    !inMonth && "bg-stone-50/60 dark:bg-white/[0.015]",
                    dragOver === d && "bg-accent-50 dark:bg-accent-800/20",
                  )}
                >
                  <button
                    onClick={() => setPicked(d)}
                    aria-pressed={(picked ?? today) === d}
                    className={cx(
                      "mb-1 flex h-8 w-8 items-center justify-center rounded-full text-footnote sm:h-6 sm:w-6",
                      d === today ? "bg-accent font-bold text-white dark:text-[#06201c]" : (picked ?? today) === d ? "bg-accent-soft font-semibold text-accent-ink" : inMonth ? "text-ink" : "text-ink-3",
                    )}
                    aria-label={formatHebDate(d, { weekday: true })}
                  >
                    {parseDate(d).getUTCDate()}
                  </button>
                  <div className="hidden space-y-0.5 sm:block">
                    {data.events.slice(0, 2).map((e) => (
                      <EventChip key={e.key} e={e} conflict={conflicts.has(e.key)} onClick={() => setEventEdit(e.event)} small />
                    ))}
                    {data.tasks.slice(0, Math.max(0, 3 - Math.min(2, data.events.length))).map((t) => (
                      <TaskChip key={t.key} inst={t} conflict={conflicts.has(t.key)} small />
                    ))}
                    {items > 3 && <div className="px-1 text-[11px] text-stone-500">+{items - 3}</div>}
                    {data.deadlines.map((t) => (
                      <div key={t.key} className="flex items-center gap-1 truncate px-1 text-[11px] text-rose-600">
                        <Flag size={10} /> {t.title}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-0.5 sm:hidden">
                    {data.events.map((e) => (
                      <span key={e.key} className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                    ))}
                    {data.tasks.map((t) => (
                      <span key={t.key} className={cx("h-1.5 w-1.5 rounded-full", t.status === "completed" ? "bg-stone-300" : "bg-accent-600")} />
                    ))}
                    {data.deadlines.length > 0 && <Flag size={8} className="text-rose-600" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "month" && (
        <div className="mt-4">
          <AgendaDay date={picked ?? (cursor.slice(0, 7) === today.slice(0, 7) ? today : startOfMonth(cursor))} today={today} data={byDay.get(picked ?? (cursor.slice(0, 7) === today.slice(0, 7) ? today : startOfMonth(cursor)))} onEvent={setEventEdit} expanded />
        </div>
      )}

      {view === "agenda" && (
        <div className="space-y-5">
          {[...byDay.entries()].map(([d, data]) => (
            <AgendaDay key={d} date={d} today={today} data={data} onEvent={setEventEdit} />
          ))}
          <Button variant="ghost" className="w-full" onClick={() => step(1)}>
            השבוע הבא
          </Button>
        </div>
      )}

      {view === "week" && (
        <div className="grid gap-3 md:grid-cols-7 md:gap-0 md:overflow-hidden md:rounded-2xl md:border md:hairline">
          {[...byDay.entries()].map(([d, data]) => {
            const load = dayLoad(db, d, data.tasks);
            return (
              <div
                key={d}
                {...dropProps(d)}
                className={cx(
                  "surface min-h-24 rounded-2xl border p-2 md:min-h-[420px] md:rounded-none md:border-0 md:border-s",
                  d === today && "ring-2 ring-accent-500/40 md:ring-0 md:bg-accent-50/40 dark:md:bg-accent-800/10",
                  dragOver === d && "bg-accent-50 dark:bg-accent-800/20",
                )}
              >
                <button
                  className="mb-2 flex w-full items-baseline justify-between gap-1 text-start"
                  onClick={() => {
                    setCursor(d);
                    setView("day");
                  }}
                >
                  <span className={cx("text-sm font-semibold", d === today && "text-accent-700 dark:text-accent-200")}>
                    {WEEKDAYS_HE[parseDate(d).getUTCDay()]} {parseDate(d).getUTCDate()}
                  </span>
                  {load.plannedMinutes > 0 && (
                    <span className={cx("text-[11px]", load.over ? "font-semibold text-amber-700" : "text-stone-400")} title={load.availableMinutes != null ? `פנוי: ${formatDuration(load.availableMinutes)}` : undefined}>
                      {formatDuration(load.plannedMinutes)}
                      {load.over && " ⚠"}
                    </span>
                  )}
                </button>
                <div className="space-y-1">
                  {data.events.map((e) => (
                    <EventChip key={e.key} e={e} conflict={conflicts.has(e.key)} onClick={() => setEventEdit(e.event)} />
                  ))}
                  {data.tasks.map((t) => (
                    <TaskChip key={t.key} inst={t} conflict={conflicts.has(t.key)} />
                  ))}
                  {data.habits.map((h) => (
                    <HabitChip key={h.id} h={h} done={db.habitLogs[`${h.id}:${d}`]?.status === "done"} />
                  ))}
                  {data.deadlines.map((t) => (
                    <div key={t.key} className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs text-rose-700 dark:text-rose-300">
                      <Flag size={12} /> דדליין: {t.title}
                    </div>
                  ))}
                  <button
                    className="w-full rounded-lg py-1 text-xs text-stone-400 hover:bg-stone-50 hover:text-stone-600 dark:hover:bg-white/5"
                    onClick={() => openEditor({ defaults: { date: d } })}
                    aria-label={`הוספת משימה ל${formatHebDate(d)}`}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "day" && (
        <DayView
          date={cursor}
          data={byDay.get(cursor)!}
          conflicts={conflicts}
          dragOver={dragOver}
          dropProps={dropProps}
          onEvent={setEventEdit}
          habitsDone={(h) => db.habitLogs[`${h.id}:${cursor}`]?.status === "done"}
          load={dayLoad(db, cursor, byDay.get(cursor)?.tasks)}
        />
      )}

      {eventEdit && <EventEditor event={eventEdit} onClose={() => setEventEdit(null)} />}
    </div>
  );
}

/** One day as a list (agenda / month): events, tasks (with their full menu: move, tomorrow, skip…), habits. */
function AgendaDay({ date, today, data, onEvent, expanded }: { date: string; today: string; data?: DayData; onEvent: (e: CalendarEvent) => void; expanded?: boolean }) {
  const quickAdd = useQuickAdd((s) => s.show);
  const db = useStore((s) => s.db);
  if (!data) return null;
  const empty = !data.events.length && !data.tasks.length && !data.deadlines.length;
  const head = (
    <div className="mb-1.5 flex min-h-9 items-center justify-between gap-2 px-1">
      <h3 className={cx("text-footnote font-semibold", date === today ? "text-accent-ink" : "text-ink-2")}>
        {date === today || date === addDays(today, 1) ? `${relativeDayLabel(date, today)} · ` : ""}
        {formatHebDate(date, { weekday: true })}
      </h3>
      <button type="button" onClick={() => quickAdd(date)} aria-label={`הוספה ל${formatHebDate(date)}`} className="grid h-9 w-9 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink">
        <Plus size={18} />
      </button>
    </div>
  );
  if (empty && !expanded)
    return (
      <section>
        {head}
        <p className="px-1 text-footnote text-ink-3">{data.habits.length ? `פנוי · ${data.habits.length} הרגלים` : "פנוי"}</p>
      </section>
    );
  return (
    <section>
      {head}
      <div className="overflow-hidden rounded-panel border border-line bg-surface">
        {empty && <p className="px-4 py-3 text-body text-ink-3">אין משימות או אירועים.</p>}
        <div className="divide-y divide-line">
          {[...data.events]
            .sort((a, b) => (a.event.startTime ?? "") < (b.event.startTime ?? "") ? -1 : 1)
            .map((e) => (
              <button key={e.key} type="button" onClick={() => onEvent(e.event)} className="flex min-h-[52px] w-full items-center gap-3 px-4 text-start">
                <CalendarDays size={16} className="shrink-0 text-sky-600 dark:text-sky-400" aria-label="אירוע" />
                <span className="min-w-0 flex-1 truncate text-body text-ink">{e.event.title}</span>
                <span className="tnum shrink-0 text-footnote text-ink-2">{e.event.startTime ? `${e.event.startTime}${e.event.endTime ? `–${e.event.endTime}` : ""}` : "כל היום"}</span>
                {e.event.recurrence && <Repeat size={12} className="shrink-0 text-ink-3" aria-label="חוזר" />}
              </button>
            ))}
          {[...data.tasks]
            .sort((a, b) => (a.startTime ?? "99") < (b.startTime ?? "99") ? -1 : 1)
            .map((t) => (
              <TaskRow key={t.key} inst={t} />
            ))}
          {data.deadlines.map((t) => (
            <div key={t.key} className="flex min-h-11 items-center gap-3 px-4 text-footnote text-warn">
              <Flag size={14} /> דדליין: {t.title}
            </div>
          ))}
        </div>
        {data.habits.length > 0 && (
          <p className="border-t border-line px-4 py-2.5 text-footnote text-ink-2">
            הרגלים: {data.habits.map((h) => `${db.habitLogs[`${h.id}:${date}`]?.status === "done" ? "✓ " : ""}${h.title}`).join(" · ")}
          </p>
        )}
      </div>
    </section>
  );
}

function Legend() {
  return (
    <Details className="mb-3" label="מקרא">
    <div className="flex flex-wrap gap-3 text-xs text-stone-500">
      <span className="flex items-center gap-1">
        <span className="h-3 w-3 rounded border-s-4 border-accent-600 bg-white dark:bg-stone-800" /> משימה
      </span>
      <span className="flex items-center gap-1">
        <span className="h-3 w-3 rounded bg-sky-500" /> אירוע
      </span>
      <span className="flex items-center gap-1">
        <span className="h-3 w-3 rounded border border-dashed border-violet-500" /> הרגל
      </span>
      <span className="flex items-center gap-1 text-rose-600">
        <Flag size={12} /> דדליין
      </span>
      <span className="flex items-center gap-1 text-rose-600">
        <AlertTriangle size={12} /> התנגשות בזמנים
      </span>
    </div>
    <p className="mt-2">להזזת משימה: בתפריט ⋯ שלה — ״למחר״ או ״דחייה / תזמון מחדש״. במחשב אפשר גם לגרור בין ימים ושעות.</p>
    </Details>
  );
}

function TaskChip({ inst, conflict, small }: { inst: TaskInstance; conflict?: boolean; small?: boolean }) {
  const db = useStore((s) => s.db);
  const openEditor = useUI((s) => s.openEditor);
  const goal = inst.task.goalId ? db.goals[inst.task.goalId] : null;
  const done = inst.status === "completed";
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", JSON.stringify({ type: "task", key: inst.key }))}
      className={cx(
        "group flex cursor-grab items-center gap-1.5 rounded-lg border border-s-4 bg-white px-1.5 py-1 text-xs shadow-sm active:cursor-grabbing dark:bg-stone-800",
        goal ? goalColor(goal.color).border : "border-s-stone-400",
        conflict ? "border-rose-400" : "hairline",
        (done || inst.status === "skipped") && "opacity-50",
      )}
    >
      {!small && (
        <button
          onClick={() => void toggleComplete(inst)}
          aria-label={`סימון: ${inst.title}`}
          className={cx("h-3.5 w-3.5 shrink-0 rounded-full border", done ? "border-accent-600 bg-accent-600" : "border-stone-400")}
        />
      )}
      <button className={cx("min-w-0 flex-1 truncate text-start", done && "line-through")} onClick={() => openEditor({ instance: inst })}>
        {inst.startTime && <span className="ltr-nums me-1 text-stone-500">{inst.startTime}</span>}
        {inst.title}
      </button>
      {inst.recurring && !small && <Repeat size={10} className="shrink-0 text-stone-400" />}
      {conflict && <AlertTriangle size={10} className="shrink-0 text-rose-500" aria-label="התנגשות" />}
    </div>
  );
}

function EventChip({ e, conflict, onClick, small }: { e: EventInstance; conflict?: boolean; onClick: () => void; small?: boolean }) {
  return (
    <button
      draggable={!e.event.recurrence}
      onDragStart={(ev) => ev.dataTransfer.setData("text/plain", JSON.stringify({ type: "event", key: e.event.id }))}
      onClick={onClick}
      className={cx("flex w-full items-center gap-1 truncate rounded-lg bg-sky-500 px-1.5 py-1 text-start text-xs text-white", conflict && "ring-2 ring-rose-400")}
    >
      {e.event.startTime && !small && <span className="ltr-nums opacity-80">{e.event.startTime}</span>}
      <span className="truncate">{e.event.title}</span>
      {e.event.recurrence && <Repeat size={10} className="shrink-0 opacity-80" />}
    </button>
  );
}

function HabitChip({ h, done }: { h: Habit; done: boolean }) {
  return (
    <div className={cx("flex items-center gap-1 truncate rounded-lg border border-dashed border-violet-400 px-1.5 py-1 text-xs text-violet-700 dark:text-violet-300", done && "opacity-50 line-through")}>
      <Repeat size={10} /> {h.title}
    </div>
  );
}

function DayView({
  date,
  data,
  conflicts,
  dragOver,
  dropProps,
  onEvent,
  habitsDone,
  load,
}: {
  date: string;
  data: DayData;
  conflicts: Set<string>;
  dragOver: string | null;
  dropProps: (d: string, t?: string) => object;
  onEvent: (e: CalendarEvent) => void;
  habitsDone: (h: Habit) => boolean;
  load: ReturnType<typeof dayLoad>;
}) {
  const START = 6;
  const END = 23;
  const HOUR_PX = 56;
  const untimed = data.tasks.filter((t) => !t.startTime);
  const timed = data.tasks.filter((t) => t.startTime);
  const timedEvents = data.events.filter((e) => e.event.startTime);
  const allDayEvents = data.events.filter((e) => !e.event.startTime);
  const top = (t: string) => ((timeToMinutes(t) - START * 60) / 60) * HOUR_PX;
  return (
    <div className="space-y-4">
      <div className="surface rounded-2xl border p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-semibold">כל היום / ללא שעה</span>
          {load.availableMinutes != null && (
            <Badge tone={load.over ? "amber" : "stone"}>
              {formatDuration(load.plannedMinutes) || "0"} / {formatDuration(load.availableMinutes)} פנויות
            </Badge>
          )}
        </div>
        <div className="space-y-1" {...dropProps(date)}>
          {allDayEvents.map((e) => (
            <EventChip key={e.key} e={e} onClick={() => onEvent(e.event)} />
          ))}
          {untimed.map((t) => (
            <TaskChip key={t.key} inst={t} />
          ))}
          {data.habits.map((h) => (
            <HabitChip key={h.id} h={h} done={habitsDone(h)} />
          ))}
          {data.deadlines.map((t) => (
            <div key={t.key} className="flex items-center gap-1 text-xs text-rose-700">
              <Flag size={12} /> דדליין: {t.title}
            </div>
          ))}
          {!allDayEvents.length && !untimed.length && !data.habits.length && !data.deadlines.length && <p className="text-xs text-stone-400">—</p>}
        </div>
      </div>
      <div className="surface relative overflow-hidden rounded-2xl border">
        <div className="relative" style={{ height: (END - START) * HOUR_PX }}>
          {Array.from({ length: END - START }, (_, i) => {
            const h = START + i;
            const t = `${String(h).padStart(2, "0")}:00`;
            return (
              <div
                key={h}
                {...dropProps(date, t)}
                className={cx("absolute inset-x-0 border-t hairline", dragOver === date + t && "bg-accent-50 dark:bg-accent-800/20")}
                style={{ top: i * HOUR_PX, height: HOUR_PX }}
              >
                <span className="ltr-nums absolute start-2 top-1 text-[11px] text-stone-400">{t}</span>
              </div>
            );
          })}
          {[
            ...timedEvents.map((e) => ({ key: e.key, start: e.event.startTime!, end: e.event.endTime, node: <EventChip e={e} conflict={conflicts.has(e.key)} onClick={() => onEvent(e.event)} /> })),
            ...timed.map((t) => ({
              key: t.key,
              start: t.startTime!,
              end: minutesToTime(Math.min(timeToMinutes(t.startTime!) + (t.task.estimatedMinutes || 30), 23 * 60 + 59)),
              node: <TaskChip inst={t} conflict={conflicts.has(t.key)} />,
            })),
          ]
            .filter((x) => timeToMinutes(x.start) >= START * 60)
            .map((x, idx) => {
              const h = Math.max(28, ((timeToMinutes(x.end ?? minutesToTime(timeToMinutes(x.start) + 60)) - timeToMinutes(x.start)) / 60) * HOUR_PX - 2);
              const overlapIdx = conflicts.has(x.key) ? idx % 2 : 0;
              return (
                <div key={x.key} className="absolute pe-2" style={{ top: top(x.start) + 1, height: h, insetInlineStart: 56 + overlapIdx * 40, insetInlineEnd: 8 }}>
                  {x.node}
                </div>
              );
            })}
        </div>
      </div>
      {timed.some((t) => timeToMinutes(t.startTime!) < START * 60) && <p className="text-xs text-stone-500">יש משימות לפני 06:00 — מוצגות ברשימת המשימות.</p>}
    </div>
  );
}
