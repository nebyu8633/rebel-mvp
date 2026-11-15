"use client";
/**
 * Quick capture sheet: one line of Hebrew → task / event / habit / note.
 * The parsed result is always visible as chips (date, time, reminder, priority, recurrence) and
 * editable before saving. Ambiguous hours/days must be chosen; recurrence must be confirmed;
 * nothing is invented. "פרטים נוספים" hands the parsed draft to the full editor.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import { Bell, CalendarDays, Clock, Flag, Repeat, ArrowUp } from "lucide-react";
import { useStore, useSettings } from "@/lib/store/store";
import { useUI } from "@/lib/store/ui";
import { useToday } from "@/hooks/useToday";
import { parseQuick } from "@/lib/quickParse";
import { blankTask, nowIso, saveTask, uid } from "@/lib/actions";
import { relativeDayLabel } from "@/lib/dates";
import type { Habit, RecurrenceRule } from "@/lib/types";
import { Modal, Segmented, cx } from "./ui";
import { Chip } from "./ds";

type Kind = "task" | "event" | "habit" | "note";
export const useQuickAdd = create<{ open: boolean; date: string | null; show(date?: string | null): void; hide(): void }>((set) => ({
  open: false,
  date: null,
  show: (date = null) => set({ open: true, date }),
  hide: () => set({ open: false, date: null }),
}));

export function QuickAddHost() {
  const open = useQuickAdd((s) => s.open);
  if (!open) return null;
  return <QuickAdd />;
}

function QuickAdd() {
  const hide = useQuickAdd((s) => s.hide);
  const presetDate = useQuickAdd((s) => s.date);
  const today = useToday();
  const settings = useSettings();
  const put = useStore((s) => s.put);
  const toast = useStore((s) => s.toast);
  const openEditor = useUI((s) => s.openEditor);
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<Kind>("task");
  const [saving, setSaving] = useState(false);
  // user overrides on top of the parse (undefined = take the parse)
  const [o, setO] = useState<{ date?: string | null; time?: string | null; reminder?: number | null; high?: boolean; repeat?: boolean; picks: Record<string, string> }>({ picks: {} });

  const parsed = useMemo(() => parseQuick(text, today), [text, today]);
  // choices for ambiguous parts
  const pickedTime = parsed.ambiguities.find((a) => a.kind === "time");
  const pickedDay = parsed.ambiguities.find((a) => a.kind === "weekday");
  const date = o.date !== undefined ? o.date : (parsed.date ?? (pickedDay ? (o.picks[pickedDay.text] ?? null) : null) ?? (kind === "note" ? null : (presetDate ?? today)));
  const time = o.time !== undefined ? o.time : (parsed.time ?? (pickedTime ? (o.picks[pickedTime.text] ?? null) : null));
  const defaultReminder = settings?.defaultReminderMinutes ?? 15;
  const reminder = o.reminder !== undefined ? o.reminder : time && (parsed.wantsReminder || kind === "task" || kind === "event") ? defaultReminder : null;
  const high = o.high ?? parsed.priority === "high";
  const repeat = !!parsed.recurrence && !!o.repeat;
  const unresolved = parsed.ambiguities.filter((a) => !o.picks[a.text] && !(a.kind === "time" && o.time !== undefined) && !(a.kind === "weekday" && o.date !== undefined));
  const title = parsed.title;
  const canSave = title.length > 0 && unresolved.length === 0 && !saving && (kind !== "event" || !!date);

  useEffect(() => {
    const t = setTimeout(() => input.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);
  // a new parse (text changed) resets choices that no longer apply
  useEffect(() => setO((x) => ({ ...x, picks: Object.fromEntries(Object.entries(x.picks).filter(([k]) => parsed.ambiguities.some((a) => a.text === k))) })), [parsed.ambiguities]);

  const rule = (): RecurrenceRule | null => (repeat && parsed.recurrence ? { ...parsed.recurrence, startDate: date ?? parsed.recurrence.startDate } : null);

  async function save(more = false) {
    if (!canSave && !more) return;
    if (more) {
      hide();
      openEditor({ defaults: { title, date, startTime: time, reminderMinutes: time ? reminder : null, priority: high ? "high" : "medium", recurrence: rule() } });
      return;
    }
    setSaving(true);
    const n = nowIso();
    let ok = false;
    let label = "המשימה נוספה";
    if (kind === "event") {
      ok = await put("events", { id: uid(), title, date: date!, startTime: time, endTime: null, location: "", notes: "", recurrence: rule(), reminderMinutes: time ? reminder : null, createdAt: n, updatedAt: n });
      label = "האירוע נוסף ליומן";
    } else if (kind === "habit") {
      const r = parsed.recurrence;
      const frequency: Habit["frequency"] = r?.freq === "weekly" && r.byWeekday?.length ? { type: "weekdays", days: r.byWeekday } : { type: "daily" };
      ok = await put("habits", { id: uid(), title, goalId: null, frequency, startDate: date ?? today, paused: false, reminderTime: time, order: Date.now(), createdAt: n, updatedAt: n });
      label = "ההרגל נוסף";
    } else {
      const t = blankTask({ title, date: kind === "note" ? null : date, startTime: kind === "note" ? null : time, priority: high ? "high" : "medium", reminderMinutes: time && kind !== "note" ? reminder : null, recurrence: kind === "note" ? null : rule() });
      ok = await saveTask(t);
      label = kind === "note" ? "הפתק נשמר" : "המשימה נוספה";
    }
    setSaving(false);
    if (ok) {
      toast(label, "success");
      hide();
    }
  }

  const chip = "bg-surface-2 border-transparent";
  return (
    <Modal open onClose={hide} title="הוספה מהירה">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="flex items-center gap-2 rounded-field border border-line bg-surface px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
          <input
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={kind === "event" ? "פגישה עם רועי ביום שלישי ב-14:00" : kind === "habit" ? "הליכה כל יום ב-7 בבוקר" : kind === "note" ? "רעיון, קישור, משהו לזכור" : "לקנות חלב מחר ב-18:00"}
            aria-label="מה להוסיף"
            enterKeyHint="done"
            autoComplete="off"
            className="h-12 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
          />
          <button type="submit" disabled={!canSave} aria-label="שמירה" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-white transition-opacity disabled:opacity-30 dark:text-[#06201c]">
            <ArrowUp size={18} />
          </button>
        </div>

        {/* what was understood — every part is visible and changeable */}
        {text.trim() && (
          <div className="mt-3 flex flex-wrap gap-2" aria-live="polite">
            {kind !== "note" && (
              <label className={cx("relative inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-footnote font-medium", chip)}>
                <CalendarDays size={14} className="text-ink-2" />
                {date ? relativeDayLabel(date, today) : "ללא תאריך"}
                <input type="date" value={date ?? ""} onChange={(e) => setO({ ...o, date: e.target.value || null })} className="absolute inset-0 opacity-0" aria-label="תאריך" />
              </label>
            )}
            {kind !== "note" && !unresolved.some((a) => a.kind === "time") && (
              <label className={cx("relative inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-footnote font-medium", chip)}>
                <Clock size={14} className="text-ink-2" />
                <span className="tnum">{time ?? "ללא שעה"}</span>
                <input type="time" value={time ?? ""} onChange={(e) => setO({ ...o, time: e.target.value || null })} className="absolute inset-0 opacity-0" aria-label="שעה" />
              </label>
            )}
            {kind !== "note" && time && (
              <Chip icon={<Bell size={14} />} className={chip} onClick={() => setO({ ...o, reminder: reminder == null ? defaultReminder : reminder === defaultReminder ? 0 : null })}>
                {reminder == null ? "בלי תזכורת" : reminder === 0 ? "תזכורת בזמן" : `תזכורת ${reminder} דק׳ לפני`}
              </Chip>
            )}
            {kind !== "note" && !time && parsed.wantsReminder && <Chip tone="warn">לתזכורת צריך שעה</Chip>}
            {(kind === "task" || kind === "note") && (
              <button
                type="button"
                aria-pressed={high}
                aria-label="סימון כחשוב"
                onClick={() => setO({ ...o, high: !high })}
                className={cx("inline-flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-full border px-2.5 text-footnote font-medium", high ? "border-transparent bg-warn-soft text-warn" : "border-transparent bg-surface-2 text-ink-3")}
              >
                <Flag size={14} />
                {high && "חשוב"}
              </button>
            )}
            {parsed.recurrence && kind !== "note" && kind !== "habit" && (
              <Chip icon={<Repeat size={14} />} selected={repeat} tone={repeat ? "neutral" : "warn"} onClick={() => setO({ ...o, repeat: !repeat })}>
                {repeat ? parsed.recurrenceLabel : `${parsed.recurrenceLabel}? לאישור`}
              </Chip>
            )}
            {kind === "habit" && <Chip tone="accent" icon={<Repeat size={14} />}>{parsed.recurrence?.freq === "weekly" ? parsed.recurrenceLabel : "כל יום"}</Chip>}
          </div>
        )}

        {/* questions that must be answered — the parser never guesses these */}
        {unresolved.map((a) => (
          <div key={a.text} className="mt-3 flex flex-wrap items-center gap-2 rounded-field bg-warn-soft px-3 py-2 text-footnote text-ink" role="group" aria-label={`הבהרה: ${a.text}`}>
            <span>
              <bdi className="font-semibold">{a.text}</bdi> — {a.kind === "time" ? "בבוקר או בערב?" : "היום או בשבוע הבא?"}
            </span>
            {a.options.map((opt) => (
              <Chip key={opt.value} className="bg-surface" onClick={() => setO({ ...o, picks: { ...o.picks, [a.text]: opt.value } })}>
                {opt.label}
              </Chip>
            ))}
          </div>
        ))}
        {parsed.recurrence && !repeat && kind !== "habit" && kind !== "note" && text.trim() && (
          <p className="mt-2 text-footnote text-ink-3">בלי אישור החזרתיות, נשמר כפעם אחת.</p>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <Segmented
            size="sm"
            value={kind}
            onChange={setKind}
            options={[
              { value: "task", label: "משימה" },
              { value: "event", label: "אירוע" },
              { value: "habit", label: "הרגל" },
              { value: "note", label: "פתק" },
            ]}
          />
          {kind === "task" && (
            <button type="button" onClick={() => void save(true)} className="min-h-9 px-2 text-footnote font-medium text-accent-ink">
              פרטים נוספים
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
