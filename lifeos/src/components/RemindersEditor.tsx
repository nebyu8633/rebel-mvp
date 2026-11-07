"use client";
import { useState } from "react";
import { Bell, BellOff, Trash2, Plus } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { Reminder } from "@/lib/types";
import { nowIso, uid } from "@/lib/actions";
import { formatHebDate } from "@/lib/dates";
import { Button, Input, Select, cx } from "./ui";

const PRESETS: Array<[Reminder["kind"], number, string]> = [
  ["before_start", 10, "10 דק׳ לפני ההתחלה"],
  ["before_start", 60, "שעה לפני ההתחלה"],
  ["before_deadline", 24 * 60, "יום לפני הדדליין (09:00)"],
  ["before_deadline", 3 * 24 * 60, "3 ימים לפני הדדליין"],
];

export function describeReminder(r: Reminder): string {
  if (r.kind === "at") return `${r.date ? formatHebDate(r.date) : ""} ${r.time ?? ""}`.trim();
  if (r.kind === "before_deadline") return r.minutes! >= 1440 ? `${Math.round(r.minutes! / 1440)} ימים לפני הדדליין` : `${r.minutes} דק׳ לפני הדדליין`;
  return r.minutes ? (r.minutes >= 60 && r.minutes % 60 === 0 ? `${r.minutes / 60} שע׳ לפני ההתחלה` : `${r.minutes} דק׳ לפני ההתחלה`) : "בזמן ההתחלה";
}

/** One or more reminders for a saved task. Times use the time zone from Settings. */
export function RemindersEditor({ taskId }: { taskId: string }) {
  const db = useStore((s) => s.db);
  const put = useStore((s) => s.put);
  const remove = useStore((s) => s.remove);
  const task = db.tasks[taskId];
  const list = Object.values(db.reminders).filter((r) => r.taskId === taskId);
  const [preset, setPreset] = useState("0");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [err, setErr] = useState<string | null>(null);
  if (!task) return <p className="text-xs text-stone-500">אפשר להוסיף תזכורות נוספות אחרי השמירה.</p>;

  async function add() {
    setErr(null);
    const n = nowIso();
    let r: Reminder;
    if (preset === "at") {
      if (!date || !time) return setErr("נא לבחור תאריך ושעה");
      r = { id: uid(), taskId, kind: "at", minutes: null, date, time, enabled: true, createdAt: n, updatedAt: n };
    } else {
      const [kind, minutes] = PRESETS[Number(preset)];
      if (kind === "before_start" && !task.startTime) return setErr("למשימה אין שעת התחלה");
      if (kind === "before_deadline" && !task.deadline) return setErr("למשימה אין דדליין");
      r = { id: uid(), taskId, kind, minutes, date: null, time: null, enabled: true, createdAt: n, updatedAt: n };
    }
    if (list.some((x) => x.kind === r.kind && x.minutes === r.minutes && x.date === r.date && x.time === r.time)) return setErr("תזכורת זהה כבר קיימת");
    const v = Reminder.safeParse(r);
    if (!v.success) return setErr(v.error.issues[0]?.message ?? "שגיאה");
    await put("reminders", v.data);
  }

  return (
    <div className="space-y-2">
      {list.length > 0 && (
        <ul className="space-y-1">
          {list.map((r) => (
            <li key={r.id} className="flex items-center gap-2 text-sm">
              <button
                type="button"
                aria-label={r.enabled ? "השבתת תזכורת" : "הפעלת תזכורת"}
                aria-pressed={r.enabled}
                onClick={() => void put("reminders", { ...r, enabled: !r.enabled, updatedAt: nowIso() })}
                className={cx("rounded-lg p-1", r.enabled ? "text-accent-700" : "text-stone-400")}
              >
                {r.enabled ? <Bell size={14} /> : <BellOff size={14} />}
              </button>
              <span className={cx("flex-1", !r.enabled && "text-stone-400 line-through")}>{describeReminder(r)}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="מחיקת תזכורת" onClick={() => void remove("reminders", r.id)}>
                <Trash2 size={13} />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Select className="w-auto py-1.5 text-sm" value={preset} onChange={(e) => setPreset(e.target.value)} aria-label="סוג תזכורת">
          {PRESETS.map(([, , l], i) => (
            <option key={l} value={String(i)}>
              {l}
            </option>
          ))}
          <option value="at">בתאריך ושעה…</option>
        </Select>
        {preset === "at" && (
          <>
            <Input type="date" className="w-auto py-1.5 text-sm" value={date} onChange={(e) => setDate(e.target.value)} aria-label="תאריך תזכורת" />
            <Input type="time" className="w-auto py-1.5 text-sm" value={time} onChange={(e) => setTime(e.target.value)} aria-label="שעת תזכורת" />
          </>
        )}
        <Button size="sm" variant="subtle" onClick={add}>
          <Plus size={14} /> תזכורת
        </Button>
      </div>
      {err && <p className="text-xs text-rose-600">{err}</p>}
    </div>
  );
}
