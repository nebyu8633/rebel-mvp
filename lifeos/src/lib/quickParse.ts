/**
 * Quick capture: a deterministic Hebrew parser for one-line task input
 * ("לקנות חלב מחר ב-18:00", "להתקשר לבנק ביום ראשון", "כל יום שני אימון ב-7 בבוקר").
 *
 * Rules (product): it never invents a date or time that wasn't written; an hour without a
 * part-of-day ("ב-6") is AMBIGUOUS and must be chosen by the user; recurrence is only a
 * SUGGESTION that needs explicit confirmation; anything not understood stays in the title.
 * Pure: no clock access — `today` is passed in.
 */
import type { RecurrenceRule } from "./types";
import { addDays, weekday } from "./dates";

export interface Ambiguity {
  kind: "time" | "weekday";
  /** What was written, for the question ("ב-6"). */
  text: string;
  options: Array<{ value: string; label: string }>;
}

export interface QuickParse {
  title: string;
  date: string | null;
  time: string | null;
  priority: "high" | null;
  /** The text asked for a reminder ("תזכיר לי …"). */
  wantsReminder: boolean;
  /** Suggested only — never saved without confirmation. */
  recurrence: RecurrenceRule | null;
  recurrenceLabel: string | null;
  ambiguities: Ambiguity[];
}

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"] as const;
const DAY_LABEL = DAYS.map((d, i) => (i === 6 ? "שבת" : `יום ${d}`));
const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (h: number, m: number) => `${pad(h)}:${pad(m)}`;

// Hebrew has no \b for letters; delimit by start/space/punctuation.
const B = "(?<=^|[\\s,.;:!?()\"'״׳-])";
const E = "(?=$|[\\s,.;:!?()\"'״׳])";
// optional preposition prefix: ב / ב- / ל / ל-
const PRE = "(?:[בל]-?)?";
const DAYPART = "(?:ב?בוקר|ב?ערב|בלילה|לילה|אחה(?:\"|״)צ|אחר הצהריים|בצהריים|צהריים)";

function daypartHour(h: number, part: string | undefined): number | null {
  if (!part) return null;
  if (/בוקר/.test(part)) return h === 12 ? 0 : h;
  if (/צהריים/.test(part) && !/אחר/.test(part)) return h >= 11 ? h : h + 12; // "ב-1 בצהריים" = 13:00
  // afternoon / evening / night
  if (/לילה/.test(part)) return h === 12 ? 0 : h <= 4 ? h : h + 12;
  return h === 12 ? 12 : h + 12;
}

function ruleFor(start: string, partial: Partial<RecurrenceRule>): RecurrenceRule {
  return { freq: "weekly", interval: 1, startDate: start, endDate: null, count: null, paused: false, exceptions: [], missedPolicy: "carry", backupWeekday: null, ...partial } as RecurrenceRule;
}

/** Next date (>= today) falling on weekday `wd`; same weekday as today is ambiguous (today / next week). */
function nextWeekday(today: string, wd: number): { date: string; sameDay: boolean } {
  const diff = (wd - weekday(today) + 7) % 7;
  return { date: addDays(today, diff), sameDay: diff === 0 };
}

export function parseQuick(input: string, today: string): QuickParse {
  let text = ` ${input.trim()} `;
  /** part of day implied by "כל ערב" / "הערב" — used only to resolve an hour that IS written */
  let impliedPart: string | undefined;
  const out: QuickParse = { title: "", date: null, time: null, priority: null, wantsReminder: false, recurrence: null, recurrenceLabel: null, ambiguities: [] };
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => boolean | void) => {
    const m = text.match(re);
    if (!m || m.index == null) return;
    if (fn(m) === false) return;
    text = `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`;
  };

  // reminder intent
  take(new RegExp(`${B}(?:תזכיר(?:י)? לי|תזכורת)(?:\\s*ל-?|\\s*:)?${E}`), () => void (out.wantsReminder = true));
  // priority
  take(new RegExp(`${B}(?:חשוב|דחוף)${E}`), () => void (out.priority = "high"));
  take(/!+/, () => void (out.priority = "high"));

  // recurrence (suggestion)
  take(new RegExp(`${B}כל\\s+(?:יום\\s+)?(${DAYS.join("|")})${E}`), (m) => {
    const wd = DAYS.indexOf(m[1] as (typeof DAYS)[number]);
    const first = nextWeekday(today, wd).date;
    out.recurrence = ruleFor(first, { freq: "weekly", byWeekday: [wd] });
    out.recurrenceLabel = `כל ${DAY_LABEL[wd]}`;
    out.date = first;
  });
  if (!out.recurrence)
    take(new RegExp(`${B}כל\\s+(יום|בוקר|ערב|לילה)${E}`), (m) => {
      out.recurrence = ruleFor(today, { freq: "daily" });
      out.recurrenceLabel = m[1] === "יום" ? "כל יום" : `כל יום (${m[1]})`;
      if (m[1] !== "יום") impliedPart = m[1];
    });
  if (!out.recurrence)
    take(new RegExp(`${B}כל\\s+שבוע${E}`), () => {
      out.recurrence = ruleFor(today, { freq: "weekly", byWeekday: [weekday(today)] });
      out.recurrenceLabel = `כל שבוע (${DAY_LABEL[weekday(today)]})`;
    });
  if (!out.recurrence)
    take(new RegExp(`${B}כל\\s+חודש${E}`), () => {
      out.recurrence = ruleFor(today, { freq: "monthly", byMonthDay: Number(today.slice(8)) });
      out.recurrenceLabel = `כל חודש (ב-${Number(today.slice(8))})`;
    });

  // relative dates
  if (!out.date)
    take(new RegExp(`${B}${PRE}(מחרתיים|מחר|היום|הערב|הלילה)${E}`), (m) => {
      out.date = addDays(today, m[1] === "מחרתיים" ? 2 : m[1] === "מחר" ? 1 : 0);
      if (m[1] === "הערב") impliedPart = "ערב";
      if (m[1] === "הלילה") impliedPart = "לילה";
    });
  // weekday ("ביום שני", "יום שני", "בשבת", "ביום ב׳")
  if (!out.date)
    take(new RegExp(`${B}(?:ב?יום\\s+(${DAYS.slice(0, 6).join("|")})|ב?(שבת))${E}`), (m) => {
      const wd = DAYS.indexOf((m[1] ?? m[2]) as (typeof DAYS)[number]);
      const n = nextWeekday(today, wd);
      if (n.sameDay) {
        out.ambiguities.push({ kind: "weekday", text: m[0].trim(), options: [{ value: today, label: "היום" }, { value: addDays(today, 7), label: "בשבוע הבא" }] });
      } else out.date = n.date;
    });
  // explicit date d/m or d.m (optionally /yy or /yyyy)
  if (!out.date)
    take(new RegExp(`${B}${PRE}(\\d{1,2})[./](\\d{1,2})(?:[./](\\d{2}|\\d{4}))?${E}`), (m) => {
      const d = Number(m[1]);
      const mo = Number(m[2]);
      if (d < 1 || d > 31 || mo < 1 || mo > 12) return false;
      let y = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : Number(today.slice(0, 4));
      let iso = `${y}-${pad(mo)}-${pad(d)}`;
      if (!m[3] && iso < today) iso = `${++y}-${pad(mo)}-${pad(d)}`;
      const check = new Date(`${iso}T12:00:00Z`);
      if (check.getUTCDate() !== d) return false; // 31/02
      out.date = iso;
    });

  // time: "18:30" anywhere; or a bare hour after ב / בשעה ("ב-6", "בשעה 18"), optional part of day
  take(new RegExp(`${B}(?:${PRE}|בשעה\\s+)(\\d{1,2}):(\\d{2})(?:\\s+(${DAYPART}))?${E}`), (m) => {
    let h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return false;
    const part = m[3] ?? impliedPart;
    if (part && h <= 12) h = daypartHour(h, part) ?? h;
    out.time = hhmm(h, min);
  });
  if (!out.time)
    take(new RegExp(`${B}(?:ב-?|בשעה\\s+)(\\d{1,2})(?:\\s+(${DAYPART}))?${E}`), (m) => {
      const h = Number(m[1]);
      if (h > 23) return false;
      const fromPart = daypartHour(h, m[2] ?? impliedPart);
      if (fromPart != null && h <= 12) out.time = hhmm(fromPart, 0);
      else if (h === 0 || h >= 13 || h === 12) out.time = hhmm(h, 0);
      else out.ambiguities.push({ kind: "time", text: m[0].trim(), options: [{ value: hhmm(h, 0), label: hhmm(h, 0) }, { value: hhmm(h + 12, 0), label: hhmm(h + 12, 0) }] });
    });
  // a part of day alone ("בערב") is not a time: leave it in the title rather than invent one

  out.title = text
    .replace(/\s+/g, " ")
    .replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, "")
    .trim();
  // recurring item starts on its first date
  if (out.recurrence && out.date) out.recurrence = { ...out.recurrence, startDate: out.date };
  return out;
}
