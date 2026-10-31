/**
 * Date helpers.
 *
 * All calendar math is done on plain "YYYY-MM-DD" strings using UTC-midnight Date
 * objects internally, so adding days never drifts across daylight-saving changes.
 * Conversions to real instants (for notifications) go through the user's IANA time zone.
 */

export function parseDate(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function fmtDate(dt: Date): string {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(d: string, n: number): string {
  const dt = parseDate(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fmtDate(dt);
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** Add months, clamping the day (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(d: string, n: number): string {
  const dt = parseDate(d);
  const y = dt.getUTCFullYear();
  const m = dt.getUTCMonth() + n;
  const targetY = y + Math.floor(m / 12);
  const targetM = ((m % 12) + 12) % 12;
  const day = Math.min(dt.getUTCDate(), daysInMonth(targetY, targetM));
  return fmtDate(new Date(Date.UTC(targetY, targetM, day)));
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000);
}

/** Whole months between two dates (b - a), ignoring partial months. */
export function diffMonths(a: string, b: string): number {
  const A = parseDate(a);
  const B = parseDate(b);
  let m = (B.getUTCFullYear() - A.getUTCFullYear()) * 12 + (B.getUTCMonth() - A.getUTCMonth());
  if (B.getUTCDate() < A.getUTCDate()) m -= 1;
  return m;
}

export function weekday(d: string): number {
  return parseDate(d).getUTCDay();
}

export function startOfWeek(d: string, weekStartsOn = 0): string {
  const wd = weekday(d);
  const diff = (wd - weekStartsOn + 7) % 7;
  return addDays(d, -diff);
}

export function startOfMonth(d: string): string {
  return d.slice(0, 8) + "01";
}

export function rangeDays(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function minDate(a: string, b: string) {
  return a < b ? a : b;
}
export function maxDate(a: string, b: string) {
  return a > b ? a : b;
}

// ───────────── Time zones ─────────────

/** Calendar date and wall time "now" in a given time zone. */
export function nowInZone(tz: string, at: Date = new Date()): { date: string; time: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const time = `${get("hour")}:${get("minute")}`;
  return { date, time, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

export function todayInZone(tz: string): string {
  return nowInZone(tz).date;
}

function zoneOffsetMs(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUTC - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * Convert a wall-clock date+time in `tz` to a UTC instant. DST-safe:
 * for times skipped by a spring-forward gap, the result lands after the gap;
 * for repeated times (fall-back), the first occurrence is used.
 */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = zoneOffsetMs(tz, new Date(guess));
  let result = guess - off1;
  const off2 = zoneOffsetMs(tz, new Date(result));
  if (off2 !== off1) {
    const alt = guess - off2;
    // Prefer the candidate that maps back to the requested wall time.
    result = nowInZone(tz, new Date(alt)).time === time ? alt : Math.max(result, alt);
  }
  return new Date(result);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ───────────── Hebrew formatting ─────────────

export const WEEKDAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
export const WEEKDAYS_SHORT_HE = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
export const MONTHS_HE = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

export function formatHebDate(d: string, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const dt = parseDate(d);
  const base = `${dt.getUTCDate()} ב${MONTHS_HE[dt.getUTCMonth()]}`;
  const wd = opts.weekday ? `יום ${WEEKDAYS_HE[dt.getUTCDay()]}, ` : "";
  const yr = opts.year ? ` ${dt.getUTCFullYear()}` : "";
  return wd + base + yr;
}

export function formatShortDate(d: string): string {
  const dt = parseDate(d);
  return `${dt.getUTCDate()}.${dt.getUTCMonth() + 1}`;
}

/** Hebrew-calendar date, e.g. "ט׳ בחשוון תשפ״ז". */
export function formatJewishDate(d: string): string {
  try {
    return new Intl.DateTimeFormat("he-IL-u-ca-hebrew", {
      timeZone: "UTC",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(parseDate(d));
  } catch {
    return "";
  }
}

export function relativeDayLabel(d: string, today: string): string {
  const diff = diffDays(today, d);
  if (diff === 0) return "היום";
  if (diff === 1) return "מחר";
  if (diff === -1) return "אתמול";
  if (diff > 1 && diff < 7) return `יום ${WEEKDAYS_HE[weekday(d)]}`;
  return formatHebDate(d);
}

export function formatDuration(min: number | null | undefined): string {
  if (!min) return "";
  if (min < 60) return `${min} דק׳`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hs = h === 1 ? "שעה" : h === 2 ? "שעתיים" : `${h} שע׳`;
  return m ? `${hs} ו-${m} דק׳` : hs;
}

export function greetingFor(minutes: number): string {
  if (minutes < 5 * 60) return "לילה טוב";
  if (minutes < 12 * 60) return "בוקר טוב";
  if (minutes < 17 * 60) return "צהריים טובים";
  if (minutes < 21 * 60) return "ערב טוב";
  return "לילה טוב";
}
