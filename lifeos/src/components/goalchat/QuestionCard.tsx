"use client";
import { useState } from "react";
import { Check, SkipForward } from "lucide-react";
import type { Question } from "@/lib/goalplan/schema";
import { WEEKDAYS_HE, WEEKDAYS_SHORT_HE, addMonths, formatHebDate } from "@/lib/dates";
import { Button, Input, Spinner, cx } from "../ui";

export interface QuestionAnswer {
  value: string | number | string[] | null;
  estimate?: boolean;
}

/** Interactive answer component for a structured question. */
export function QuestionCard({
  q,
  today,
  busy,
  error,
  onAnswer,
  onSkip,
}: {
  q: Question;
  today: string;
  busy: boolean;
  error: string | null;
  onAnswer: (a: QuestionAnswer) => void;
  onSkip?: () => void;
}) {
  const [multi, setMulti] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [estimate, setEstimate] = useState(false);
  const [custom, setCustom] = useState(false);
  const numeric = q.input === "number" || q.input === "currency";
  const submitText = () => text.trim() && onAnswer({ value: text.trim(), estimate });

  return (
    <div className="animate-in mt-2 space-y-3 rounded-2xl border border-accent-200 bg-accent-50/40 p-3 dark:border-accent-800/50 dark:bg-accent-800/10" role="group" aria-label={q.text || "בחירה"}>
      {q.help && <p className="text-xs text-stone-500">{q.help}</p>}

      {(q.input === "single" || (q.options.length > 0 && q.input !== "multi" && q.input !== "weekdays")) && (
        <div className="flex flex-wrap gap-2">
          {q.options.map((o) => (
            <button
              key={o.value}
              type="button"
              disabled={busy}
              onClick={() => onAnswer({ value: q.input === "number" || q.input === "currency" ? Number(o.value) : o.value })}
              className="surface rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors hover:border-accent-500 hover:bg-accent-50 disabled:opacity-50 dark:hover:bg-accent-800/20"
            >
              {q.input === "date" && /^\d+$/.test(o.value) ? `${o.label} (${formatHebDate(addMonths(today, Number(o.value)))})` : o.label}
            </button>
          ))}
          {q.input === "single" && q.allowCustom && !custom && (
            <button type="button" onClick={() => setCustom(true)} className="rounded-xl border border-dashed hairline px-3.5 py-2 text-sm text-stone-500 hover:text-stone-800">
              תשובה אחרת…
            </button>
          )}
        </div>
      )}

      {q.input === "multi" && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {q.options.map((o) => {
              const on = multi.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setMulti(on ? multi.filter((x) => x !== o.value) : [...multi, o.value])}
                  className={cx("flex items-center gap-1 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors", on ? "border-accent-600 bg-accent-600 text-white" : "surface hover:border-accent-500")}
                >
                  {on && <Check size={14} />} {o.label}
                </button>
              );
            })}
          </div>
          {q.allowCustom && <Input placeholder="משהו אחר (רשות)" value={text} onChange={(e) => setText(e.target.value)} aria-label="תשובה נוספת" />}
          <Button variant="primary" size="sm" disabled={busy || (!multi.length && !text.trim())} onClick={() => onAnswer({ value: [...multi, ...(text.trim() ? [text.trim()] : [])] })}>
            {busy ? <Spinner /> : <Check size={14} />} אישור הבחירה
          </Button>
        </div>
      )}

      {q.input === "weekdays" && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="ימים">
            {WEEKDAYS_SHORT_HE.map((d, i) => {
              const v = String(i);
              const on = multi.includes(v);
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={on}
                  aria-label={WEEKDAYS_HE[i]}
                  onClick={() => setMulti(on ? multi.filter((x) => x !== v) : [...multi, v].sort())}
                  className={cx("h-10 w-10 rounded-full text-sm font-medium", on ? "bg-accent-600 text-white" : "surface border")}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <Button variant="primary" size="sm" disabled={busy || !multi.length} onClick={() => onAnswer({ value: multi })}>
            {busy ? <Spinner /> : <Check size={14} />} אישור
          </Button>
        </div>
      )}

      {(numeric || q.input === "date" || q.input === "text" || custom) && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submitText();
          }}
        >
          <div className="relative min-w-40 flex-1">
            {q.input === "currency" && <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-stone-400">₪</span>}
            <Input
              autoFocus={q.input !== "single"}
              type={q.input === "date" ? "date" : "text"}
              inputMode={numeric ? "decimal" : undefined}
              min={q.input === "date" ? today : undefined}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={numeric ? (q.unit ? `מספר (${q.unit})` : "סכום") : q.input === "date" ? "" : "התשובה שלך"}
              aria-label={q.text || "תשובה"}
            />
          </div>
          <Button type="submit" variant="primary" disabled={busy || !text.trim()}>
            {busy ? <Spinner /> : "שליחה"}
          </Button>
          {numeric && (
            <label className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300">
              <input type="checkbox" className="accent-accent-600" checked={estimate} onChange={(e) => setEstimate(e.target.checked)} />
              זו הערכה
            </label>
          )}
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}
      {q.skippable && onSkip && (
        <button type="button" disabled={busy} onClick={onSkip} className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800">
          <SkipForward size={12} /> לא יודע/ת עדיין — לדלג
        </button>
      )}
    </div>
  );
}
