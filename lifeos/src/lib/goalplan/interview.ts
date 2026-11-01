/**
 * Built-in (non-AI) adaptive interview. Picks the next most relevant unanswered question for
 * a goal, extracts facts from the user's own words, records answers as typed profile facts
 * (confirmed / estimate), and detects contradictions. Pure functions — easy to test.
 */
import type { GoalKind } from "../types";
import type { FactKind, ProfileFact, Question } from "./schema";
import { addMonths, addDays, diffDays, formatHebDate, WEEKDAYS_HE } from "../dates";
import { formatILS } from "../finance";

export type Facts = Record<string, ProfileFact>;

export const STAGES = [
  "הגדרת המטרה",
  "הבנת נקודת ההתחלה",
  "הגדרת היעד ומדדי ההצלחה",
  "בחינת מגבלות ומשאבים",
  "בניית אסטרטגיית ביצוע",
  "תכנון אבני הדרך",
  "בניית לוח הזמנים",
  "בדיקה ואישור",
];

export const KIND_LABEL: Record<GoalKind, string> = {
  weight: "שינוי משקל",
  portfolio: "תיק השקעות",
  motorcycle: "רכישת אופנוע",
  purchase: "רכישה / חיסכון",
  income: "הגדלת הכנסה",
  learning: "למידה",
  custom: "מטרה כללית",
};

// ───────── Detection ─────────

const KIND_PATTERNS: Array<[GoalKind, RegExp]> = [
  ["weight", /(קילו|ק"ג|ק״ג|קג\b|משקל|לעלות \d|להעלות \d|לרדת \d|מסת שריר)/],
  ["portfolio", /(תיק השקעות|תיק ההשקעות|השקעות|מניות|קרן מחקה|תיק בשווי)/],
  ["motorcycle", /(אופנוע|קטנוע)/],
  ["purchase", /(לקנות|לרכוש|רכישת|לחסוך ל|חיסכון ל|רכב|דירה|מחשב)/],
  ["income", /(הכנסה|משכורת|שכר|להרוויח|הכנסות|עבודה נוספת|העלאה)/],
  ["learning", /(ללמוד|לימוד|שפה|קורס|תואר|אנגלית|ספרדית|גרמנית|ערבית|צרפתית|תכנות|פסנתר|גיטרה)/],
];

export function detectKind(text: string): GoalKind {
  for (const [k, re] of KIND_PATTERNS) if (re.test(text)) return k;
  return "custom";
}

/** Split a message that describes several different goals. Returns ≥2 segments only when kinds differ. */
export function splitGoals(text: string): Array<{ text: string; kind: GoalKind }> {
  const parts = text
    .split(/\n|\.|;|,? ?(?:וגם|ובנוסף|בנוסף לזה|וחוץ מזה) /)
    .map((p) => p.trim())
    .filter((p) => p.length > 6);
  const segs = parts.map((p) => ({ text: p, kind: detectKind(p) }));
  const distinct = new Set(segs.filter((s) => s.kind !== "custom").map((s) => s.kind));
  return distinct.size >= 2 ? segs.filter((s) => s.kind !== "custom") : [];
}

export function suggestTitle(text: string, kind: GoalKind): string {
  const t = text.replace(/^(אני )?(רוצה|רוצים|מתכנן|מתכננת|שואף|שואפת) ?(ל)?/, "").trim();
  const base = t.length >= 3 ? t : KIND_LABEL[kind];
  const s = base.length > 60 ? base.slice(0, 57) + "…" : base;
  return s.charAt(0) === "ל" || !t ? s : s;
}

function parseAmount(raw: string): number | null {
  const m = raw.match(/(\d[\d,.]*)\s*(אלף|K|k)?/);
  if (!m) return null;
  let n = Number(m[1].replace(/,/g, ""));
  if (Number.isNaN(n)) return null;
  if (m[2]) n *= 1000;
  return n;
}

/** Pull facts the user already stated, so we never ask them again. */
export function extractFacts(text: string, kind: GoalKind, today: string, now: string): Facts {
  const f: Facts = {};
  const put = (key: string, label: string, value: ProfileFact["value"], display: string, kindF: FactKind = "confirmed") =>
    (f[key] = { key, label, value, display, kind: kindF, source: "user", updatedAt: now });

  // time horizon
  const months = text.match(/(?:בתוך|תוך|עד|ב)\s*(\d+)\s*חודש/);
  const years = text.match(/(?:בתוך|תוך)\s*(\d+)\s*שנים/);
  let target: string | null = null;
  if (/(?:בתוך|תוך|במהלך)\s*(?:שנה|השנה)(?!\s*\d)/.test(text)) target = addMonths(today, 12);
  else if (/(?:בתוך|תוך)\s*שנתיים/.test(text)) target = addMonths(today, 24);
  else if (/(?:בתוך|תוך)\s*חצי שנה/.test(text)) target = addMonths(today, 6);
  else if (months) target = addMonths(today, Number(months[1]));
  else if (years) target = addMonths(today, 12 * Number(years[1]));
  if (target) put("targetDate", "תאריך יעד", target, formatHebDate(target, { year: true }));

  const ils = text.match(/(\d[\d,.]*\s*(?:אלף|K|k)?)\s*(?:₪|ש"ח|ש״ח|שקל|שקלים)|₪\s*(\d[\d,.]*\s*(?:אלף)?)/);
  const amount = ils ? parseAmount(ils[1] ?? ils[2]) : null;

  if (kind === "weight") {
    const kg = text.match(/(\d+(?:\.\d+)?)\s*(?:קילו|ק"ג|ק״ג|קג)/);
    if (kg) {
      const gain = !/(לרדת|להוריד|לרזות)/.test(text);
      put("targetChange", gain ? "יעד עלייה במשקל" : "יעד ירידה במשקל", gain ? Number(kg[1]) : -Number(kg[1]), `${gain ? "+" : "−"}${kg[1]} ק״ג`);
    }
  }
  if (kind === "portfolio" && amount) put("targetValue", "יעד שווי תיק", amount, formatILS(amount));
  if ((kind === "purchase" || kind === "motorcycle") && amount) put("price", "מחיר משוער", amount, formatILS(amount), "estimate");
  if (kind === "motorcycle") put("item", "מה רוצים לרכוש", "אופנוע", "אופנוע");
  if (kind === "income" && amount) put("targetIncome", "יעד הכנסה חודשית", amount, formatILS(amount));
  if (kind === "learning") {
    const lang = text.match(/(אנגלית|ספרדית|גרמנית|ערבית|צרפתית|איטלקית|יפנית|סינית|רוסית|פורטוגזית)/);
    if (lang) put("subject", "מה לומדים", lang[1], lang[1]);
  }
  return f;
}

// ───────── Question bank ─────────

interface QDef extends Omit<Question, "options" | "help" | "unit" | "allowCustom" | "skippable" | "critical"> {
  label: string;
  kinds: GoalKind[] | "all";
  options?: Question["options"];
  help?: string;
  unit?: string;
  allowCustom?: boolean;
  skippable?: boolean;
  critical?: boolean;
  when?: (f: Facts) => boolean;
}

const opt = (...xs: Array<[string, string]>) => xs.map(([value, label]) => ({ value, label }));
const val = (f: Facts, k: string) => f[k]?.value;

const BANK: QDef[] = [
  // 1. define
  { key: "item", label: "מה רוצים לרכוש", stage: 1, kinds: ["purchase"], input: "text", text: "מה בדיוק תרצה/י לרכוש?", help: "דגם/סוג, כמה שיותר מדויק", critical: true },
  { key: "model", label: "דגם רצוי", stage: 1, kinds: ["motorcycle"], input: "text", text: "איזה אופנוע? (יצרן, דגם או לפחות נפח מנוע)", help: "אם עוד לא החלטת — אפשר לדלג, ונוסיף שלב מחקר לתוכנית", skippable: true },
  { key: "subject", label: "מה לומדים", stage: 1, kinds: ["learning"], input: "text", text: "מה בדיוק תרצה/י ללמוד?", critical: true },
  { key: "outcome", label: "תוצאה רצויה", stage: 1, kinds: ["custom", "learning", "income"], input: "text", text: "איך תיראה הצלחה? מה יהיה שונה כשהמטרה תושג?", help: "משפט אחד, כמה שיותר מוחשי", critical: true },

  // 2. baseline
  { key: "currentWeight", label: "משקל נוכחי", stage: 2, kinds: ["weight"], input: "number", unit: "ק״ג", text: "מה המשקל הנוכחי שלך?", help: "רצוי משקילה מהימים האחרונים", critical: true },
  { key: "currentValue", label: "שווי תיק נוכחי", stage: 2, kinds: ["portfolio"], input: "currency", text: "מה שווי התיק היום?", options: opt(["0", "עוד אין לי תיק"]), allowCustom: true, critical: true },
  { key: "savedSoFar", label: "חיסכון קיים למטרה", stage: 2, kinds: ["purchase", "motorcycle"], input: "currency", text: "כמה כבר חסכת למטרה הזו?", options: opt(["0", "עוד לא התחלתי"]), allowCustom: true, critical: true },
  { key: "hasLicense", label: "רישיון מתאים", stage: 2, kinds: ["motorcycle"], input: "single", text: "יש לך רישיון לאופנוע בדרגה המתאימה?", options: opt(["yes", "כן"], ["no", "לא"], ["in_progress", "בתהליך"]), critical: true },
  { key: "currentIncome", label: "הכנסה חודשית נוכחית", stage: 2, kinds: ["income"], input: "currency", text: "מה ההכנסה החודשית הנוכחית (נטו)?", help: "נשמר רק אצלך", critical: true },
  { key: "currentLevel", label: "רמה נוכחית", stage: 2, kinds: ["learning"], input: "single", text: "מה הרמה שלך היום?", options: opt(["none", "מתחיל/ה לגמרי"], ["basic", "בסיסית"], ["intermediate", "בינונית"], ["advanced", "מתקדמת"]), critical: true },
  { key: "baseline", label: "נקודת התחלה", stage: 2, kinds: ["custom"], input: "text", text: "איפה זה עומד היום? מה כבר קיים?", critical: true },
  { key: "training", label: "אימונים היום", stage: 2, kinds: ["weight"], input: "single", text: "כמה פעמים בשבוע את/ה מתאמן/ת היום?", options: opt(["0", "לא מתאמן/ת"], ["1-2", "1–2 בשבוע"], ["3+", "3 ומעלה"]) },

  // 3. target & metrics
  { key: "targetChange", label: "יעד שינוי במשקל", stage: 3, kinds: ["weight"], input: "number", unit: "ק״ג", text: "כמה ק״ג לעלות? (מספר שלילי לירידה)", critical: true },
  { key: "targetValue", label: "יעד שווי תיק", stage: 3, kinds: ["portfolio"], input: "currency", text: "לאיזה שווי תיק תרצה/י להגיע?", options: opt(["30000", "₪30,000"]), allowCustom: true, critical: true },
  { key: "price", label: "מחיר משוער", stage: 3, kinds: ["purchase", "motorcycle"], input: "currency", text: "מה המחיר המשוער (כולל תוספות שאת/ה כבר יודע/ת עליהן)?", help: "אם לא ידוע — נוסיף משימת תמחור והיעד הכספי יושלם אחריה", skippable: true },
  { key: "targetIncome", label: "יעד הכנסה חודשית", stage: 3, kinds: ["income"], input: "currency", text: "לאיזו הכנסה חודשית תרצה/י להגיע?", critical: true },
  { key: "targetLevel", label: "רמת יעד", stage: 3, kinds: ["learning"], input: "single", text: "לאיזו רמה תרצה/י להגיע?", options: opt(["conversation", "שיחה בסיסית"], ["fluent", "שיחה שוטפת"], ["exam", "עמידה במבחן/תעודה"], ["work", "שימוש מקצועי"]), allowCustom: true, critical: true },
  { key: "metric", label: "מדד הצלחה", stage: 3, kinds: ["custom"], input: "text", text: "איך נדע שהמטרה הושגה? איזה מספר או סימן אפשר למדוד?", help: "למשל: ״5 ק״מ ריצה ברצף״, ״10 לקוחות״", critical: true },
  { key: "metricTarget", label: "ערך יעד למדד", stage: 3, kinds: ["custom"], input: "number", text: "מה ערך היעד במספרים (אם יש)?", skippable: true },
  { key: "targetDate", label: "תאריך יעד", stage: 3, kinds: "all", input: "date", text: "עד מתי?", options: opt(["3", "3 חודשים"], ["6", "חצי שנה"], ["12", "שנה"], ["24", "שנתיים"]), allowCustom: true, critical: true },

  // 4. constraints & resources
  { key: "monthlySaving", label: "חיסכון חודשי אפשרי", stage: 4, kinds: ["purchase", "motorcycle"], input: "currency", text: "כמה אפשר לחסוך בחודש למטרה הזו?", critical: true },
  { key: "monthlyContribution", label: "הפקדה חודשית אפשרית", stage: 4, kinds: ["portfolio"], input: "currency", text: "כמה תוכל/י להפקיד בחודש?", help: "אם לא בטוח — דלג/י, ונחשב כמה נדרש", skippable: true },
  { key: "health", label: "מגבלות בריאותיות/תזונתיות", stage: 4, kinds: ["weight"], input: "single", text: "יש מגבלה רפואית או תזונתית שכדאי לקחת בחשבון?", options: opt(["no", "לא"], ["yes", "כן"], ["private", "מעדיף/ה לא לפרט"]) },
  { key: "budget", label: "תקציב", stage: 4, kinds: ["learning", "custom", "income"], input: "currency", text: "יש תקציב שאפשר להשקיע (קורס, ציוד, ליווי)?", options: opt(["0", "אין תקציב"]), allowCustom: true, skippable: true },
  { key: "weeklyHours", label: "שעות בשבוע למטרה", stage: 4, kinds: "all", input: "number", unit: "שעות", text: "כמה שעות בשבוע אפשר להקדיש למטרה הזו באופן ריאלי?", options: opt(["1", "שעה"], ["2", "שעתיים"], ["3", "3 שעות"], ["5", "5 שעות"], ["8", "8 שעות"]), allowCustom: true, critical: true },
  { key: "obstacles", label: "מכשולים צפויים", stage: 4, kinds: "all", input: "multi", text: "מה עלול לעכב אותך?", options: opt(["time", "חוסר זמן"], ["motivation", "ירידה במוטיבציה"], ["money", "כסף"], ["knowledge", "חוסר ידע"], ["health", "בריאות/עייפות"]), allowCustom: true, skippable: true },

  // 5. strategy
  { key: "incomePath", label: "דרך להגדלת ההכנסה", stage: 5, kinds: ["income"], input: "multi", text: "באילו דרכים תרצה/י לפעול?", options: opt(["raise", "העלאת שכר"], ["job", "מעבר עבודה"], ["side", "עבודה/פרויקט נוסף"], ["business", "עסק עצמאי"], ["skills", "רכישת מקצוע/מיומנות"]), allowCustom: true, critical: true },
  { key: "method", label: "שיטת לימוד", stage: 5, kinds: ["learning"], input: "multi", text: "איך תעדיף/י ללמוד?", options: opt(["app", "אפליקציה"], ["course", "קורס/שיעורים"], ["tutor", "מורה פרטי"], ["self", "ספרים/תכנים עצמאיים"], ["practice", "שיחות תרגול"]), allowCustom: true },
  { key: "licenseTimeline", label: "תכנון רישיון", stage: 5, kinds: ["motorcycle"], input: "single", text: "מתי תרצה/י לסיים את הרישיון?", options: opt(["first", "קודם רישיון, אחר כך חיסכון"], ["parallel", "במקביל לחיסכון"]), when: (f) => val(f, "hasLicense") !== "yes" },

  // 7. schedule
  { key: "preferredDays", label: "ימים מועדפים", stage: 7, kinds: "all", input: "weekdays", text: "באילו ימים נוח לך לעבוד על המטרה?", help: "אפשר לבחור כמה. משמש לשיבוץ", skippable: true },
  { key: "preferredTime", label: "שעה מועדפת", stage: 7, kinds: "all", input: "single", text: "באיזה חלק של היום?", options: opt(["morning", "בוקר"], ["noon", "צהריים"], ["evening", "ערב"], ["flexible", "גמיש — בלי שעה קבועה"]) },
  { key: "reviewDay", label: "יום בדיקת התקדמות", stage: 7, kinds: "all", input: "single", text: "באיזה יום לעשות בדיקת התקדמות קצרה (פעם בשבוע)?", options: WEEKDAYS_HE.map((d, i) => ({ value: String(i), label: d })) },
];

export const LABELS: Record<string, string> = Object.fromEntries(BANK.map((q) => [q.key, q.label]));

function relevant(q: QDef, kind: GoalKind, f: Facts) {
  return (q.kinds === "all" || q.kinds.includes(kind)) && (!q.when || q.when(f));
}

function toQuestion(q: QDef): Question {
  return {
    key: q.key,
    stage: q.stage,
    text: q.text,
    help: q.help ?? "",
    input: q.input,
    options: q.options ?? [],
    allowCustom: q.allowCustom ?? (q.input === "single" || q.input === "multi"),
    unit: q.unit ?? "",
    critical: q.critical ?? false,
    skippable: q.skippable ?? !q.critical,
  };
}

export function questionFor(key: string): Question | null {
  const q = BANK.find((x) => x.key === key);
  return q ? toQuestion(q) : null;
}

/** Next relevant question not yet answered or skipped; null when the interview is complete. */
export function nextQuestion(kind: GoalKind, facts: Facts, skipped: string[]): Question | null {
  const q = BANK.filter((q) => relevant(q, kind, facts)).find((q) => !facts[q.key] && !skipped.includes(q.key));
  return q ? toQuestion(q) : null;
}

/** Critical questions still open (the plan can't be finalised without them). */
export function missingCritical(kind: GoalKind, facts: Facts): string[] {
  return BANK.filter((q) => relevant(q, kind, facts) && q.critical && !facts[q.key]).map((q) => q.label);
}

export function progressStage(kind: GoalKind, facts: Facts, skipped: string[]): number {
  const q = nextQuestion(kind, facts, skipped);
  return q ? q.stage : 8;
}

// ───────── Answers ─────────

export interface Answer {
  value: string | number | string[] | null;
  /** User flagged the number as an estimate. */
  estimate?: boolean;
}

export function displayValue(q: Question, value: Answer["value"]): string {
  if (value == null || value === "") return "—";
  if (q.input === "currency") return formatILS(Number(value));
  if (q.input === "number") return `${value}${q.unit ? " " + q.unit : ""}`;
  if (q.input === "date") return formatHebDate(String(value), { year: true });
  if (q.input === "weekdays") return (value as string[]).map((d) => WEEKDAYS_HE[Number(d)]).join(", ");
  const label = (v: string) => q.options.find((o) => o.value === v)?.label ?? v;
  if (Array.isArray(value)) return value.map(label).join(", ");
  return label(String(value));
}

/** Normalise and validate a raw answer. Returns an error message in Hebrew on failure. */
export function normalizeAnswer(q: Question, raw: Answer["value"], today: string): { value: Answer["value"]; error?: string } {
  if (raw == null || (typeof raw === "string" && raw.trim() === "") || (Array.isArray(raw) && raw.length === 0))
    return { value: null, error: "נא לבחור או לכתוב תשובה" };
  switch (q.input) {
    case "number":
    case "currency": {
      const n = typeof raw === "number" ? raw : parseAmount(String(raw));
      if (n == null || !Number.isFinite(n)) return { value: null, error: "נא להזין מספר" };
      if (q.input === "currency" && n < 0) return { value: null, error: "סכום לא יכול להיות שלילי" };
      if (q.key === "currentWeight" && (n < 25 || n > 350)) return { value: null, error: "משקל לא סביר" };
      if (q.key === "weeklyHours" && (n <= 0 || n > 80)) return { value: null, error: "בין 0.5 ל-80 שעות" };
      return { value: n };
    }
    case "date": {
      let d = String(raw);
      if (/^\d+$/.test(d)) d = addMonths(today, Number(d)); // option = months from today
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { value: null, error: "תאריך לא תקין" };
      if (d <= today) return { value: null, error: "תאריך היעד חייב להיות בעתיד" };
      return { value: d };
    }
    case "weekdays":
    case "multi":
      return { value: Array.isArray(raw) ? raw.map(String) : String(raw).split(",").map((s) => s.trim()).filter(Boolean) };
    default:
      return { value: typeof raw === "string" ? raw.trim().slice(0, 1000) : String(raw) };
  }
}

export function makeFact(q: Question, value: Answer["value"], now: string, estimate = false): ProfileFact {
  return {
    key: q.key,
    label: LABELS[q.key] ?? q.text,
    value: value as ProfileFact["value"],
    display: displayValue(q, value),
    kind: estimate ? "estimate" : "confirmed",
    source: "user",
    updatedAt: now,
  };
}

// ───────── Contradictions & acknowledgements ─────────

export function contradictions(kind: GoalKind, f: Facts, today: string): string[] {
  const out: string[] = [];
  const n = (k: string) => (typeof f[k]?.value === "number" ? (f[k].value as number) : null);
  const td = f.targetDate?.value as string | undefined;
  if (td && td <= today) out.push("תאריך היעד כבר עבר.");
  if (kind === "portfolio" && n("currentValue") != null && n("targetValue") != null && n("targetValue")! <= n("currentValue")!)
    out.push(`היעד (${formatILS(n("targetValue"))}) לא גבוה משווי התיק הנוכחי (${formatILS(n("currentValue"))}).`);
  if (kind === "income" && n("currentIncome") != null && n("targetIncome") != null && n("targetIncome")! <= n("currentIncome")!)
    out.push("יעד ההכנסה לא גבוה מההכנסה הנוכחית.");
  if ((kind === "purchase" || kind === "motorcycle") && n("price") != null && n("savedSoFar") != null && n("savedSoFar")! >= n("price")!)
    out.push("החיסכון הקיים כבר מכסה את המחיר — אולי אפשר לקצר מאוד את התוכנית.");
  if ((kind === "purchase" || kind === "motorcycle") && n("price") != null && n("monthlySaving") != null && td) {
    const months = Math.max(1, Math.round(diffDays(today, td) / 30.4));
    const need = (n("price")! - (n("savedSoFar") ?? 0)) / months;
    if (n("monthlySaving")! > 0 && need > n("monthlySaving")! * 1.05)
      out.push(`כדי להגיע ליעד בזמן צריך לחסוך כ-${formatILS(Math.ceil(need))} בחודש, יותר מ-${formatILS(n("monthlySaving"))} שציינת.`);
  }
  if (kind === "weight" && n("targetChange") != null && td) {
    const weeks = Math.max(1, diffDays(today, td) / 7);
    const perWeek = Math.abs(n("targetChange")!) / weeks;
    if (perWeek > 0.5) out.push(`קצב של כ-${perWeek.toFixed(2)} ק״ג בשבוע הוא מהיר; כדאי לשקול תאריך יעד מאוחר יותר או להתייעץ עם איש מקצוע.`);
  }
  return out;
}

/** Short acknowledgement after an answer, so the conversation feels responsive (not a form). */
export function acknowledge(q: Question, fact: ProfileFact): string {
  if (fact.kind === "estimate") return `רשמתי ${fact.display} כהערכה — נוכל לעדכן כשיהיה מספר מדויק.`;
  if (q.key === "targetDate") return `מעולה, היעד: ${fact.display}.`;
  if (q.key === "weeklyHours") return `${fact.display} בשבוע — אבנה את התוכנית כך שלא תעבור את זה.`;
  return `רשמתי: ${fact.label} — ${fact.display}.`;
}

export function opening(kind: GoalKind, extracted: Facts): string {
  const got = Object.values(extracted);
  const head = `נשמע כמו מטרה של ${KIND_LABEL[kind]}. אשאל כמה שאלות קצרות — אחת בכל פעם — ואז אבנה טיוטת תוכנית לאישורך.`;
  return got.length ? `${head}\nכבר הבנתי מהתיאור: ${got.map((g) => `${g.label}: ${g.display}`).join(" · ")}.` : head;
}

export function dateFromMonthsOption(today: string, months: number) {
  return addDays(addMonths(today, months), 0);
}
