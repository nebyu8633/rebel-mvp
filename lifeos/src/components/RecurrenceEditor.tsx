"use client";
import type { RecurrenceRule } from "@/lib/types";
import { WEEKDAYS_HE, WEEKDAYS_SHORT_HE, weekday } from "@/lib/dates";
import { describeRule } from "@/lib/recurrence";
import { Field, Input, Select, Toggle, cx } from "./ui";

export function defaultRule(startDate: string): RecurrenceRule {
  return {
    freq: "weekly",
    interval: 1,
    byWeekday: [weekday(startDate)],
    startDate,
    endDate: null,
    count: null,
    paused: false,
    exceptions: [],
    missedPolicy: "carry",
    backupWeekday: null,
  };
}

export function RecurrenceEditor({ value, onChange }: { value: RecurrenceRule; onChange: (r: RecurrenceRule) => void }) {
  const set = (p: Partial<RecurrenceRule>) => onChange({ ...value, ...p });
  const days = value.byWeekday ?? [];
  const unitLabel = value.freq === "daily" ? "ימים" : value.freq === "weekly" ? "שבועות" : "חודשים";
  return (
    <div className="space-y-3 rounded-2xl bg-stone-50 p-3 dark:bg-white/[0.03]">
      <div className="grid grid-cols-2 gap-3">
        <Field label="תדירות">
          <Select value={value.freq} onChange={(e) => set({ freq: e.target.value as RecurrenceRule["freq"] })}>
            <option value="daily">יומי</option>
            <option value="weekly">שבועי</option>
            <option value="monthly">חודשי</option>
          </Select>
        </Field>
        <Field label={`כל כמה ${unitLabel}`}>
          <Input
            type="number"
            min={1}
            max={365}
            inputMode="numeric"
            value={value.interval}
            onChange={(e) => set({ interval: Math.max(1, Number(e.target.value) || 1) })}
          />
        </Field>
      </div>
      {value.freq === "weekly" && (
        <div>
          <span className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">ימים בשבוע</span>
          <div className="flex gap-1.5" role="group" aria-label="ימים בשבוע">
            {WEEKDAYS_SHORT_HE.map((d, i) => {
              const on = days.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={on}
                  aria-label={WEEKDAYS_HE[i]}
                  onClick={() => {
                    const next = on ? days.filter((x) => x !== i) : [...days, i].sort();
                    set({ byWeekday: next.length ? next : [i] });
                  }}
                  className={cx(
                    "h-9 w-9 rounded-full text-sm font-medium transition-colors",
                    on ? "bg-accent-600 text-white" : "surface border text-stone-600 dark:text-stone-300",
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {value.freq === "monthly" && (
        <Field label="יום בחודש" hint="בחודשים קצרים — היום האחרון בחודש">
          <Input type="number" min={1} max={31} value={value.byMonthDay ?? Number(value.startDate.slice(8))} onChange={(e) => set({ byMonthDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })} />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="מתאריך">
          <Input type="date" value={value.startDate} onChange={(e) => e.target.value && set({ startDate: e.target.value })} />
        </Field>
        <Field label="עד תאריך (רשות)">
          <Input type="date" value={value.endDate ?? ""} min={value.startDate} onChange={(e) => set({ endDate: e.target.value || null })} />
        </Field>
      </div>
      <Field label="אם מפספסים מופע" hint="לא דוחפים הכול אוטומטית למחר.">
        <Select value={value.missedPolicy} onChange={(e) => set({ missedPolicy: e.target.value as RecurrenceRule["missedPolicy"] })}>
          <option value="carry">נשאר ברשימת ״באיחור״ עד שמטפלים בו</option>
          <option value="skip">מדלגים — המופע הבא יגיע בזמנו</option>
          <option value="backup">עובר ליום גיבוי באותו שבוע</option>
        </Select>
      </Field>
      {value.missedPolicy === "backup" && (
        <Field label="יום גיבוי">
          <Select value={value.backupWeekday ?? ""} onChange={(e) => set({ backupWeekday: e.target.value === "" ? null : Number(e.target.value) })}>
            <option value="">בחרו יום</option>
            {WEEKDAYS_HE.map((d, i) => (
              <option key={i} value={i}>
                {d}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Toggle checked={value.paused} onChange={(v) => set({ paused: v })} label="השהיית הסדרה" />
      {value.exceptions.length > 0 && (
        <p className="text-xs text-stone-500">
          {value.exceptions.length} מופעים בוטלו בסדרה.{" "}
          <button type="button" className="underline" onClick={() => set({ exceptions: [] })}>
            שחזור
          </button>
        </p>
      )}
      <p className="text-xs text-stone-500">{describeRule(value)}</p>
    </div>
  );
}
