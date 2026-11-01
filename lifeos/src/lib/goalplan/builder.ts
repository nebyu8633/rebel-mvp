/**
 * Deterministic plan builder: turns a goal's profile facts into a structured GoalPlan.
 * Every item has a STABLE key (template-based) so a revised plan updates the same
 * task records instead of duplicating them. Nothing is invented: missing data becomes an
 * explicit task, assumption or unresolved item.
 */
import type { GoalKind } from "../types";
import type { Facts } from "./interview";
import type { GoalPlan, GPMilestone, GPRoutine, GPTask, GPMetric } from "./schema";
import { addDays, addMonths, diffDays, formatHebDate, maxDate, minDate, startOfMonth, startOfWeek, weekday, WEEKDAYS_HE } from "../dates";
import { formatILS, requiredMonthlyContribution } from "../finance";

const num = (f: Facts, k: string): number | null => (typeof f[k]?.value === "number" ? (f[k].value as number) : null);
const str = (f: Facts, k: string): string => (typeof f[k]?.value === "string" ? (f[k].value as string) : "");
const arr = (f: Facts, k: string): string[] => (Array.isArray(f[k]?.value) ? (f[k].value as string[]) : []);

interface Ctx {
  kind: GoalKind;
  title: string;
  f: Facts;
  today: string;
  start: string;
  target: string;
  assumptions: GoalPlan["assumptions"];
  warnings: string[];
  unresolved: string[];
}

function task(key: string, milestoneKey: string | null, title: string, durationMinutes: number, deadline: string, priority: GPTask["priority"], rationale: string, dependsOn: string[] = [], notes = ""): GPTask {
  return { key, milestoneKey, title, notes, durationMinutes, deadline, priority, rationale, dependsOn, date: null, startTime: null, reminderMinutes: null, excluded: false, userEdited: false };
}

function splitWindow(start: string, end: string, parts: number): string[] {
  const total = Math.max(parts, diffDays(start, end));
  return Array.from({ length: parts }, (_, i) => (i === parts - 1 ? end : addDays(start, Math.round((total * (i + 1)) / parts))));
}

function months(c: Ctx, key: string, end: string, titles: (i: number) => string, max = 3): GPMilestone["monthlyObjectives"] {
  const out: GPMilestone["monthlyObjectives"] = [];
  for (let m = startOfMonth(c.start), i = 0; m <= end && i < max; m = addMonths(m, 1), i++) out.push({ key: `${key}-mo${i}`, month: m, title: titles(i) });
  return out;
}
function weeks(c: Ctx, key: string, end: string, titles: (i: number) => string | null, max = 4): GPMilestone["weeklyObjectives"] {
  const out: GPMilestone["weeklyObjectives"] = [];
  for (let w = startOfWeek(c.start), i = 0; w <= end && i < max; w = addDays(w, 7), i++) {
    const t = titles(i);
    if (t) out.push({ key: `${key}-wk${i}`, weekStart: w, title: t });
  }
  return out;
}
function ms(key: string, title: string, description: string, targetDate: string, extra: Partial<GPMilestone> = {}): GPMilestone {
  return { key, title, description, targetDate, monthlyObjectives: [], weeklyObjectives: [], excluded: false, ...extra };
}

/** Preferred days → the N days to use for a weekly routine (spread out). */
export function pickDays(c: Ctx, n: number): { days: number[]; assumed: boolean } {
  const pref = arr(c.f, "preferredDays").map(Number).filter((d) => d >= 0 && d <= 6).sort();
  if (pref.length >= n) {
    const step = pref.length / n;
    return { days: Array.from({ length: n }, (_, i) => pref[Math.floor(i * step)]), assumed: false };
  }
  if (pref.length) return { days: pref, assumed: false };
  const defaults = [[3], [1, 4], [0, 2, 4], [0, 1, 3, 5], [0, 1, 2, 3, 4]][Math.min(4, Math.max(0, n - 1))];
  return { days: defaults, assumed: true };
}

function routine(c: Ctx, key: string, milestoneKey: string | null, title: string, rationale: string, perWeek: number, durationMinutes: number): GPRoutine {
  const { days, assumed } = pickDays(c, perWeek);
  if (assumed)
    c.assumptions.push({ text: `ימי "${title}" (${days.map((d) => WEEKDAYS_HE[d]).join(", ")}) הם הצעה — לא בחרת ימים מועדפים.`, kind: "assumption" });
  const first = days.map((d) => addDays(c.start, (d - weekday(c.start) + 7) % 7)).sort()[0];
  return {
    key,
    milestoneKey,
    title,
    rationale,
    freq: "weekly",
    interval: 1,
    byWeekday: days,
    backupWeekday: null,
    byMonthDay: null,
    startDate: first,
    endDate: c.target,
    durationMinutes,
    startTime: null,
    reminderMinutes: null,
    excluded: false,
    userEdited: false,
  };
}

function monthlyRoutine(c: Ctx, key: string, title: string, rationale: string, day: number, durationMinutes: number): GPRoutine {
  const first = c.start.slice(8) <= String(day).padStart(2, "0") ? `${c.start.slice(0, 8)}${String(day).padStart(2, "0")}` : `${addMonths(startOfMonth(c.start), 1).slice(0, 8)}${String(day).padStart(2, "0")}`;
  return { key, milestoneKey: null, title, rationale, freq: "monthly", interval: 1, byWeekday: [], backupWeekday: null, byMonthDay: day, startDate: first, endDate: c.target, durationMinutes, startTime: null, reminderMinutes: null, excluded: false, userEdited: false };
}

// ───────── Templates ─────────

function weightPlan(c: Ctx): Partial<GoalPlan> {
  const cur = num(c.f, "currentWeight")!;
  const change = num(c.f, "targetChange")!;
  const gain = change >= 0;
  const goalW = Math.round((cur + change) * 10) / 10;
  const ends = splitWindow(c.start, c.target, 4);
  const step = change / 4;
  const sessions = str(c.f, "training") === "0" ? 2 : 3;
  const health = str(c.f, "health");
  const tasks: GPTask[] = [
    task("w-baseline", "w-m1", "שקילת בסיס ורישום באפליקציה", 5, addDays(c.start, 2), "high", "נקודת התחלה מדויקת למעקב."),
    task("w-meals", "w-m1", "לבחור 5–7 ארוחות שאוהבים ולהוסיף לספריית הארוחות", 45, addDays(c.start, 5), "high", "תפריט שאוהבים קל יותר להתמיד בו."),
    task("w-menu", "w-m1", "לבנות ולאשר תפריט שבועי ראשון", 30, addDays(c.start, 7), "high", "התפריט המאושר יוצר את רשימת הקניות.", ["w-meals"]),
    task("w-program", "w-m1", "לבחור תוכנית אימוני כוח מתאימה", 45, addDays(c.start, 10), "medium", gain ? "אימוני כוח מכוונים את העלייה למסת שריר." : "שמירה על מסת שריר בזמן ירידה."),
    task(
      "w-pro",
      "w-m1",
      "פגישה עם דיאטן/ית קליני/ת או רופא/ה",
      45,
      addDays(c.start, health === "yes" ? 14 : 30),
      health === "yes" ? "high" : "low",
      health === "yes" ? "ציינת מגבלה רפואית/תזונתית — חשוב להתאים את התוכנית מקצועית." : "המלצה להתאמה אישית ובטיחות.",
    ),
    ...ends.slice(0, 3).map((e, i) => task(`w-review${i + 1}`, `w-m${i + 1}`, `לבחון את מגמת המשקל ולהתאים כמויות`, 20, e, "medium", "התאמה לפי מגמה בפועל, לא לפי שקילה בודדת.", i === 0 ? ["w-baseline"] : [])),
  ];
  if (health === "yes") c.warnings.push("ציינת מגבלה רפואית/תזונתית — מומלץ לאשר את התוכנית מול איש מקצוע לפני שינוי תזונה.");
  return {
    summary: `${gain ? "עלייה" : "ירידה"} הדרגתית מ-${cur} ל-${goalW} ק״ג עד ${formatHebDate(c.target, { year: true })}, דרך תפריט קבוע, הכנת אוכל ו-${sessions} אימוני כוח בשבוע.`,
    outcome: `משקל של כ-${goalW} ק״ג`,
    baseline: `${cur} ק״ג${str(c.f, "training") ? ` · אימונים: ${c.f.training.display}` : ""}`,
    successCriteria: [`משקל ממוצע (3 שקילות) של ${goalW} ק״ג או קרוב לכך`, `${sessions} אימוני כוח ברוב השבועות`],
    strategy: `${gain ? "עודף" : "גירעון"} קלורי מתון ועקבי בעזרת תפריט שבועי מאושר והכנת אוכל מראש, יחד עם אימוני כוח ומעקב שבועי אחר המגמה.`,
    rationale: "שינוי הדרגתי קל יותר לשמר ובטוח יותר; מעקב שבועי מאפשר לתקן מוקדם.",
    milestones: ends.map((e, i) =>
      ms(`w-m${i + 1}`, `${Math.round((cur + step * (i + 1)) * 10) / 10} ק״ג`, i === 0 ? "בניית שגרת אוכל, הכנה ואימונים" : "שמירה על השגרה והתאמות לפי המגמה", e, i === 0 ? {
        monthlyObjectives: months(c, "w-m1", e, (j) => ["שגרת תפריט שבועי והכנה", `${sessions} אימונים בשבוע`, "בחינת מגמה והתאמה"][j] ?? "שמירה על השגרה"),
        weeklyObjectives: weeks(c, "w-m1", e, (j) => ["שקילת בסיס ותפריט ראשון", "קניות והכנה ראשונה", "שבוע אימונים מלא", "סיכום חודש ראשון"][j] ?? null),
      } : {}),
    ),
    tasks,
    routines: [
      routine(c, "w-train", null, "אימון כוח", "תמיכה בעלייה במסת שריר", sessions, 50),
      { ...routine(c, "w-weigh", null, "שקילה שבועית", "מעקב מגמה באותו יום ושעה", 1, 5), byWeekday: [num(c.f, "reviewDay") ?? Number(str(c.f, "reviewDay") || 5)] },
    ],
    resources: ["משקל ביתי", "ספריית ארוחות ותפריט שבועי באפליקציה", "תוכנית אימונים (מאמן/אפליקציה)"],
    risks: [
      { risk: "קיפאון במשקל לכמה שבועות", mitigation: "בבדיקה השבועית — להתאים כמויות בהדרגה" },
      { risk: "שבועות עמוסים בלי הכנת אוכל", mitigation: "יום גיבוי להכנה ומנות מוכנות במקפיא" },
    ],
    metrics: [
      { key: "weight", name: "משקל", unit: "ק״ג", baseline: cur, target: goalW, source: "weight", type: "outcome" },
      { key: "sessions", name: "אימונים בשבוע", unit: "אימונים", baseline: null, target: sessions, source: "manual", type: "activity" },
    ],
  };
}

function portfolioPlan(c: Ctx): Partial<GoalPlan> {
  const cur = num(c.f, "currentValue") ?? 0;
  const target = num(c.f, "targetValue")!;
  const contrib = num(c.f, "monthlyContribution");
  const m = Math.max(1, Math.round(diffDays(c.start, c.target) / 30.4));
  const need0 = requiredMonthlyContribution(cur, target, m, 0);
  const need5 = requiredMonthlyContribution(cur, target, m, 0.05);
  c.assumptions.push({ text: "תרחיש ניטרלי של 5% תשואה שנתית הוא הנחה להמחשה בלבד; התשואה עלולה להיות שלילית.", kind: "assumption" });
  c.assumptions.push({ text: "אבני הדרך מחושבות לפי הפקדות שוות וללא תשואה (התרחיש השמרני).", kind: "assumption" });
  if (contrib != null && contrib < need5)
    c.warnings.push(`הפקדה של ${formatILS(contrib)} בחודש נמוכה מהנדרש גם בתרחיש של 5% תשואה (${formatILS(need5)}). אפשר להאריך את המועד, להגדיל הפקדה, או להנמיך את היעד.`);
  if (contrib == null) c.unresolved.push("סכום ההפקדה החודשית");
  const ends = splitWindow(c.start, c.target, 4);
  return {
    summary: `מ-${formatILS(cur)} ל-${formatILS(target)} בתוך ${m} חודשים: כ-${formatILS(need0)} בחודש ללא תשואה, או כ-${formatILS(need5)} בתרחיש של 5% (הנחה).`,
    outcome: `שווי שוק של התיק ${formatILS(target)}`,
    baseline: `שווי נוכחי: ${formatILS(cur)}${contrib != null ? ` · הפקדה אפשרית: ${formatILS(contrib)} בחודש` : ""}`,
    successCriteria: [`שווי התיק (לפי דיווח) ${formatILS(target)} ומעלה`, "הפקדה בכל חודש לפי התוכנית"],
    strategy: `הפקדה חודשית קבועה (${contrib != null ? formatILS(contrib) : "לקביעה"}) באמצעות הוראת קבע, ועדכון שווי חודשי שמפריד בין הפקדות לשינויי שוק.`,
    rationale: "הפקדה קבועה היא הגורם שבשליטתך; תשואות השוק אינן מובטחות.",
    milestones: ends.map((e, i) =>
      ms(`p-m${i + 1}`, i === 3 ? `שווי תיק ${formatILS(target)}` : `שווי ${formatILS(Math.round(cur + ((target - cur) * (i + 1)) / 4))} (מסלול ללא תשואה)`, i === 0 ? "בסיס נתונים, החלטה על הפקדה ואוטומציה" : "בדיקת מצב מול המסלול", e, i === 0 ? {
        monthlyObjectives: months(c, "p-m1", e, (j) => (j === 0 ? "נתוני בסיס והוראת קבע" : "הפקדה + עדכון שווי")),
      } : {}),
    ),
    tasks: [
      task("p-record", "p-m1", "לרשום באפליקציה את שווי התיק הנוכחי", 10, addDays(c.start, 2), "high", "בסיס לחישוב ההפקדה הנדרשת."),
      task("p-decide", "p-m1", `להחליט על סכום הפקדה חודשי (לבדוק מול ${formatILS(need5)})`, 30, addDays(c.start, 7), "high", "ההחלטה שקובעת את קצב ההתקדמות.", ["p-record"]),
      task("p-standing", "p-m1", "להגדיר הוראת קבע/הפקדה חודשית אצל הגוף המנהל", 20, addDays(c.start, 14), "high", "אוטומציה מונעת דילוג.", ["p-decide"]),
      task("p-track", "p-m1", "לבדוק את מסלול ההשקעה ודמי הניהול (רצוי מול יועץ מורשה)", 45, addDays(c.start, 21), "medium", "דמי ניהול ומסלול משפיעים על התוצאה לאורך זמן."),
      ...ends.slice(1).map((e, i) => task(`p-q${i + 2}`, `p-m${i + 2}`, "לבחון את שווי התיק מול המסלול ולהתאים הפקדה", 20, e, "medium", "תיקון מוקדם אם יש פער.")),
    ],
    routines: [monthlyRoutine(c, "p-monthly", "הפקדה ועדכון שווי תיק", "רישום הפקדה ושווי בנפרד מבדיל בין כסף שהוכנס לשינויי שוק", 2, 15)],
    resources: ["חשבון השקעות קיים", "הוראת קבע"],
    risks: [
      { risk: "ירידות בשוק", mitigation: "היעד הוא שווי שוק — ייתכן שיידרש זמן נוסף או הפקדה גבוהה יותר" },
      { risk: "הוצאה בלתי צפויה שמשבשת הפקדה", mitigation: "לקבוע סכום שאפשר לעמוד בו גם בחודש חלש" },
    ],
    metrics: [
      { key: "value", name: "שווי תיק", unit: "₪", baseline: cur, target, source: "finance", type: "outcome" },
      { key: "contrib", name: "הפקדות", unit: "₪", baseline: null, target: contrib, source: "finance", type: "activity" },
    ],
  };
}

function purchasePlan(c: Ctx): Partial<GoalPlan> {
  const isMoto = c.kind === "motorcycle";
  const item = str(c.f, "model") || str(c.f, "item") || (isMoto ? "אופנוע" : c.title);
  const price = num(c.f, "price");
  const saved = num(c.f, "savedSoFar") ?? 0;
  const monthly = num(c.f, "monthlySaving");
  const license = str(c.f, "hasLicense");
  const ms_: GPMilestone[] = [];
  const tasks: GPTask[] = [];
  const window = splitWindow(c.start, c.target, 4);
  if (price == null || (isMoto && !str(c.f, "model"))) {
    c.unresolved.push(isMoto && !str(c.f, "model") ? "דגם האופנוע" : "מחיר");
    ms_.push(ms("b-price", "תמחור מדויק", "בחירת דגם, השוואת מחירים ועלויות נלוות", minDate(addDays(c.start, 30), window[0])));
    tasks.push(
      task("b-research", "b-price", isMoto ? "לבחור 2–3 דגמים מתאימים ולהשוות מחירים" : `לבדוק 3 הצעות מחיר ל${item}`, 60, addDays(c.start, 10), "high", "בלי מחיר אי אפשר לקבוע יעד חיסכון."),
      task("b-costs", "b-price", "לרשום עלויות נלוות (ביטוח, ציוד, העברה)", 30, addDays(c.start, 14), "medium", "העלות האמיתית גבוהה ממחיר המדבקה.", ["b-research"]),
      task("b-update", "b-price", "לעדכן בשיחת התכנון את המחיר שנמצא", 10, addDays(c.start, 16), "high", "התוכנית תחושב מחדש לפי המחיר.", ["b-costs"]),
    );
  }
  if (isMoto && license !== "yes") {
    const end = str(c.f, "licenseTimeline") === "first" ? window[1] : window[2];
    ms_.push(ms("b-license", "רישיון לאופנוע", "השלמת רישיון בדרגה המתאימה", end));
    tasks.push(
      task("b-req", "b-license", "לברר דרישות רישיון לדרגה המתאימה (משרד התחבורה)", 30, addDays(c.start, 7), "high", "תנאי לרכישה ולביטוח."),
      task("b-school", "b-license", "להשוות בתי ספר לנהיגה ולקבוע שיעור ראשון", 60, addDays(c.start, 21), "high", "קובע את לוח הזמנים לטסט.", ["b-req"]),
      task("b-theory", "b-license", "לקבוע מבחן תיאוריה (אם נדרש)", 20, addDays(c.start, 30), "medium", "שלב ראשון במסלול.", ["b-req"]),
    );
  }
  const remaining = price != null ? Math.max(0, price - saved) : null;
  const m = Math.max(1, Math.round(diffDays(c.start, c.target) / 30.4));
  const need = remaining != null ? Math.ceil(remaining / m) : null;
  if (need != null && monthly != null && monthly < need)
    c.warnings.push(`כדי לחסוך ${formatILS(remaining)} עד ${formatHebDate(c.target)} צריך כ-${formatILS(need)} בחודש — יותר מ-${formatILS(monthly)} שציינת. בקצב הזה: כ-${Math.ceil(remaining! / Math.max(1, monthly))} חודשים.`);
  ms_.push(ms("b-save", price != null ? `חיסכון ${formatILS(price)}` : "חיסכון לסכום היעד", remaining != null ? `נותרו ${formatILS(remaining)}` : "הסכום ייקבע אחרי התמחור", window[2], {
    monthlyObjectives: months(c, "b-save", window[2], () => `להפקיד ${monthly != null ? formatILS(monthly) : "את הסכום החודשי"} ולעדכן יתרה`),
  }));
  tasks.push(task("b-standing", "b-save", `להגדיר העברה חודשית לחיסכון${monthly != null ? ` (${formatILS(monthly)})` : ""}`, 20, addDays(c.start, 10), "high", "אוטומציה מונעת דילוג."));
  ms_.push(ms("b-buy", `רכישת ${item}`, "בדיקה, ביטוח ורכישה", c.target));
  tasks.push(
    task("b-inspect", "b-buy", "לתאם בדיקה מקצועית לפני רכישה", 60, addDays(c.target, -14) > c.start ? addDays(c.target, -14) : c.target, "high", "מונעת הפתעות יקרות."),
    task("b-purchase", "b-buy", "לבצע רכישה, העברת בעלות וביטוח", 180, c.target, "high", "השלמת המטרה.", ["b-inspect", ...(isMoto && license !== "yes" ? ["b-theory"] : [])]),
  );
  if (isMoto) tasks.push(task("b-gear", "b-buy", "לבחור ציוד מגן (קסדה, כפפות, מעיל)", 120, addDays(c.target, -21) > c.start ? addDays(c.target, -21) : c.target, "medium", "בטיחות — וחלק מהעלות."));
  return {
    summary: `רכישת ${item} עד ${formatHebDate(c.target, { year: true })}${price != null ? ` · יעד ${formatILS(price)}, נותרו ${formatILS(remaining)}${need != null ? ` (כ-${formatILS(need)} בחודש)` : ""}` : " · המחיר ייקבע בשלב התמחור"}.`,
    outcome: `${item} בבעלותך`,
    baseline: `חיסכון קיים: ${formatILS(saved)}${monthly != null ? ` · חיסכון אפשרי: ${formatILS(monthly)} בחודש` : ""}${isMoto ? ` · רישיון: ${c.f.hasLicense?.display ?? "לא צוין"}` : ""}`,
    successCriteria: [price != null ? `חיסכון של ${formatILS(price)} בחשבון החיסכון` : "סכום היעד נקבע ונחסך", `${item} נרכש${isMoto ? " עם רישיון וביטוח בתוקף" : ""}`],
    strategy: `חיסכון חודשי אוטומטי בחשבון נפרד${isMoto && license !== "yes" ? ", רישיון במקביל" : ""}, ורכישה רק אחרי בדיקה מקצועית.`,
    rationale: "חיסכון נפרד מתיק ההשקעות שומר על הכסף זמין ולא חשוף לשוק.",
    milestones: ms_,
    tasks,
    routines: [monthlyRoutine(c, "b-monthly", "עדכון יתרת חיסכון", "מעקב חודשי מראה אם הקצב מספיק", 2, 10)],
    resources: ["חשבון חיסכון נפרד", ...(isMoto ? ["בית ספר לנהיגה", "ציוד מגן"] : [])],
    risks: [{ risk: "המחיר עולה בזמן החיסכון", mitigation: "לעדכן מחיר אחת לרבעון" }, ...(isMoto ? [{ risk: "עיכוב בטסט", mitigation: "להתחיל את הרישיון מוקדם" }] : [])],
    metrics: [{ key: "saved", name: "סכום שנחסך", unit: "₪", baseline: saved, target: price, source: "finance", type: "outcome" }],
  };
}

function incomePlan(c: Ctx): Partial<GoalPlan> {
  const cur = num(c.f, "currentIncome")!;
  const target = num(c.f, "targetIncome")!;
  const paths = arr(c.f, "incomePath");
  const ends = splitWindow(c.start, c.target, 3);
  const tasks: GPTask[] = [task("i-budget", "i-m1", "לרשום הכנסות והוצאות של החודש האחרון", 45, addDays(c.start, 5), "medium", "תמונת מצב מדויקת מראה כמה באמת חסר.")];
  const routines: GPRoutine[] = [];
  if (paths.includes("raise")) tasks.push(task("i-raise-prep", "i-m1", "להכין מסמך הישגים ובדיקת שכר שוק לתפקיד", 90, addDays(c.start, 14), "high", "בסיס עובדתי לשיחת שכר."), task("i-raise-talk", "i-m1", "לקבוע שיחת שכר עם המנהל/ת", 30, addDays(c.start, 21), "high", "הצעד הישיר ביותר להגדלת הכנסה.", ["i-raise-prep"]));
  if (paths.includes("job")) {
    tasks.push(task("i-cv", "i-m1", "לעדכן קורות חיים ופרופיל מקצועי", 120, addDays(c.start, 10), "high", "תנאי להגשת מועמדויות."));
    routines.push(routine(c, "i-apply", "i-m2", "הגשת מועמדויות ומעקב", "קצב קבוע של הגשות מגדיל סיכויים", 2, 60));
  }
  if (paths.includes("side") || paths.includes("business")) {
    tasks.push(
      task("i-offer", "i-m1", "להגדיר שירות/מוצר, קהל יעד ומחיר", 120, addDays(c.start, 14), "high", "הצעה ברורה היא הבסיס למכירה."),
      task("i-first", "i-m2", "לפנות ל-10 לקוחות פוטנציאליים ולהשיג לקוח ראשון", 180, ends[1], "high", "אימות שהשוק מוכן לשלם.", ["i-offer"]),
    );
    routines.push(routine(c, "i-work", "i-m2", "עבודה על הפרויקט/העסק", "התקדמות קבועה בזמן משוריין", 2, 90));
  }
  if (paths.includes("skills")) tasks.push(task("i-course", "i-m1", "לבחור קורס/הכשרה מבוקשת ולהירשם", 60, addDays(c.start, 21), "medium", "מיומנות מבוקשת מעלה את ערך השוק."));
  return {
    summary: `הגדלת ההכנסה החודשית מ-${formatILS(cur)} ל-${formatILS(target)} עד ${formatHebDate(c.target, { year: true })}${paths.length ? ` דרך: ${c.f.incomePath.display}` : ""}.`,
    outcome: `הכנסה חודשית של ${formatILS(target)}`,
    baseline: `הכנסה נוכחית: ${formatILS(cur)}`,
    successCriteria: [`הכנסה חודשית של ${formatILS(target)} לפחות חודשיים ברציפות`],
    strategy: paths.length ? `פעולה במקביל בערוצים שנבחרו (${c.f.incomePath.display}), עם צעד ראשון בשבועיים הקרובים בכל ערוץ.` : "בחירת ערוץ אחד או שניים ופעולה עקבית בהם.",
    rationale: "פער של " + formatILS(target - cur) + " בחודש דורש שינוי ממשי — צעדים קטנים וקבועים בערוצים שנבחרו.",
    milestones: [
      ms("i-m1", "תמונת מצב וצעדים ראשונים", "", ends[0]),
      ms("i-m2", "הכנסה נוספת ראשונה / שינוי ראשון", "", ends[1]),
      ms("i-m3", `הכנסה של ${formatILS(target)}`, "", ends[2]),
    ],
    tasks,
    routines,
    resources: paths.includes("skills") ? ["קורס/הכשרה"] : [],
    risks: [{ risk: "עומס יתר לצד העבודה הקיימת", mitigation: "לא לעבור את השעות השבועיות שהגדרת" }],
    metrics: [{ key: "main", name: "הכנסה חודשית", unit: "₪", baseline: cur, target, source: "manual", type: "outcome" }],
  };
}

function learningPlan(c: Ctx): Partial<GoalPlan> {
  const subject = str(c.f, "subject") || c.title;
  const hours = num(c.f, "weeklyHours") ?? 2;
  const perWeek = Math.min(5, Math.max(1, Math.round(hours / 0.75)));
  const sessionMin = Math.max(20, Math.min(90, Math.round((hours * 60) / perWeek / 5) * 5));
  const ends = splitWindow(c.start, c.target, 4);
  const methods = arr(c.f, "method");
  return {
    summary: `לימוד ${subject} מרמה ${c.f.currentLevel?.display ?? "נוכחית"} ל-${c.f.targetLevel?.display ?? "רמת היעד"} עד ${formatHebDate(c.target, { year: true })}, ב-${perWeek} מפגשי לימוד של ${sessionMin} דק׳ בשבוע.`,
    outcome: str(c.f, "outcome") || `${subject} ברמת ${c.f.targetLevel?.display ?? "היעד"}`,
    baseline: `רמה נוכחית: ${c.f.currentLevel?.display ?? "לא צוין"}`,
    successCriteria: [`הגעה לרמת ${c.f.targetLevel?.display ?? "היעד"} (מבחן רמה / משימה מעשית)`, `${perWeek} מפגשי לימוד ברוב השבועות`],
    strategy: `מפגשי לימוד קצרים וקבועים${methods.length ? ` (${c.f.method.display})` : ""}, מבחן רמה בכל רבעון ותרגול מעשי.`,
    rationale: "תדירות חשובה יותר ממשך — מפגשים קצרים וקבועים נשמרים לאורך זמן.",
    milestones: ends.map((e, i) =>
      ms(`l-m${i + 1}`, ["בסיס ושגרה", "תרגול ויישום", "בדיקת רמה", `רמת ${c.f.targetLevel?.display ?? "יעד"}`][i], "", e, i === 0 ? {
        weeklyObjectives: weeks(c, "l-m1", e, (j) => ["בחירת חומרים ומבחן רמה", "שבוע לימוד מלא", "תרגול ראשון בפועל", "סיכום חודש"][j] ?? null),
      } : {}),
    ),
    tasks: [
      task("l-placement", "l-m1", "לעשות מבחן רמה (מקוון/אצל מורה)", 40, addDays(c.start, 5), "high", "בסיס מדיד להתקדמות."),
      task("l-materials", "l-m1", `לבחור חומרי לימוד${methods.length ? ` (${c.f.method.display})` : ""}`, 60, addDays(c.start, 7), "high", "חומרים מתאימים לרמה מונעים תסכול."),
      ...(methods.includes("tutor") || methods.includes("course") ? [task("l-book", "l-m1", methods.includes("tutor") ? "למצוא מורה פרטי ולקבוע שיעור ניסיון" : "להירשם לקורס", 45, addDays(c.start, 14), "medium", "מסגרת חיצונית מגבירה התמדה.")] : []),
      ...ends.slice(1, 3).map((e, i) => task(`l-check${i + 2}`, `l-m${i + 2}`, "מבחן רמה חוזר והתאמת התוכנית", 40, e, "medium", "מדידה בפועל.", i === 0 ? ["l-placement"] : [])),
    ],
    routines: [routine(c, "l-study", null, `לימוד ${subject}`, "מפגש לימוד קבוע", perWeek, sessionMin)],
    resources: methods.length ? [c.f.method.display] : ["חומרי לימוד"],
    risks: [{ risk: "ירידה במוטיבציה אחרי החודש הראשון", mitigation: "יעד ביניים מוחשי ותרגול עם אנשים" }],
    metrics: [
      { key: "main", name: "רמת שפה/ציון במבחן רמה", unit: "ציון", baseline: null, target: null, source: "manual", type: "outcome" },
      { key: "sessions", name: "מפגשי לימוד", unit: "מפגשים", baseline: null, target: perWeek, source: "manual", type: "activity" },
    ],
  };
}

function customPlan(c: Ctx): Partial<GoalPlan> {
  const ends = splitWindow(c.start, c.target, 3);
  const hours = num(c.f, "weeklyHours") ?? 2;
  const perWeek = Math.min(4, Math.max(1, Math.round(hours)));
  const mt = num(c.f, "metricTarget");
  c.assumptions.push({ text: "החלוקה לשלבים היא תבנית כללית; כדאי לחדד אבני דרך ספציפיות (או לחבר AI).", kind: "assumption" });
  return {
    summary: `${c.title} עד ${formatHebDate(c.target, { year: true })} — ב-3 שלבים ו-${perWeek} מפגשי עבודה בשבוע.`,
    outcome: str(c.f, "outcome") || c.title,
    baseline: str(c.f, "baseline") || "לא צוין",
    successCriteria: [str(c.f, "metric") || "הגדרת הצלחה תיקבע בשלב הראשון"],
    strategy: "הגדרה ומחקר קצרים, ואז עבודה קבועה בזמן משוריין עם בדיקה שבועית.",
    rationale: "זמן משוריין וקבוע הוא המנבא הטוב ביותר להתקדמות במטרות פתוחות.",
    milestones: [ms("c-m1", "הגדרה וצעדים ראשונים", "", ends[0]), ms("c-m2", "ביצוע מרכזי", "", ends[1]), ms("c-m3", "השלמה", "", ends[2])],
    tasks: [
      task("c-define", "c-m1", "לפרק את המטרה ל-3 תוצרים מוחשיים", 30, addDays(c.start, 4), "high", "תוצרים ברורים מאפשרים למדוד."),
      task("c-first", "c-m1", "לבצע את הצעד הראשון בתוצר הראשון", 60, addDays(c.start, 10), "high", "תנועה מוקדמת.", ["c-define"]),
      task("c-mid", "c-m2", "בדיקת אמצע: מה עובד ומה לשנות", 30, ends[1], "medium", "תיקון כיוון."),
    ],
    routines: [routine(c, "c-work", null, `עבודה על ${c.title}`, "זמן משוריין", perWeek, Math.round((hours * 60) / perWeek))],
    resources: [],
    risks: [{ risk: "המטרה נשארת עמומה", mitigation: "להגדיר מדד מספרי בשבוע הראשון" }],
    metrics: [{ key: "main", name: str(c.f, "metric") || "התקדמות", unit: "", baseline: null, target: mt, source: mt != null ? "manual" : "milestones", type: "outcome" }],
  };
}

// ───────── Public ─────────

export function buildGoalPlan(input: { kind: GoalKind; title: string; facts: Facts; today: string; startDate?: string }): GoalPlan {
  const { kind, title, facts, today } = input;
  const target = (facts.targetDate?.value as string) || addMonths(today, 12);
  const c: Ctx = { kind, title, f: facts, today, start: maxDate(today, input.startDate ?? today), target, assumptions: [], warnings: [], unresolved: [] };
  if (!facts.targetDate) c.assumptions.push({ text: "תאריך היעד (שנה מהיום) לא אושר ע״י המשתמש.", kind: "assumption" });
  const body = (
    { weight: weightPlan, portfolio: portfolioPlan, motorcycle: purchasePlan, purchase: purchasePlan, income: incomePlan, learning: learningPlan, custom: customPlan } as const
  )[kind](c);
  // facts the user marked as estimates are surfaced, never silently treated as confirmed
  for (const fct of Object.values(facts)) if (fct.kind === "estimate") c.assumptions.push({ text: `${fct.label}: ${fct.display} — הערכה שלך, לא נתון מאומת.`, kind: "estimate" });
  const reviewDay = facts.reviewDay ? Number(facts.reviewDay.value) : 5;
  if (!facts.reviewDay) c.assumptions.push({ text: "יום הבדיקה השבועית (שישי) הוא הצעה.", kind: "assumption" });
  const routinesOut = (body.routines ?? []).map((r) =>
    r.freq === "weekly" && r.byWeekday.length
      ? { ...r, startDate: r.byWeekday.map((d) => addDays(c.start, (d - weekday(c.start) + 7) % 7)).sort()[0] }
      : r,
  );
  return {
    summary: body.summary ?? title,
    outcome: body.outcome ?? title,
    baseline: body.baseline ?? "",
    targetDate: target,
    successCriteria: body.successCriteria ?? [],
    strategy: body.strategy ?? "",
    rationale: body.rationale ?? "",
    milestones: body.milestones ?? [],
    tasks: body.tasks ?? [],
    routines: routinesOut,
    resources: body.resources ?? [],
    risks: body.risks ?? [],
    assumptions: c.assumptions,
    metrics: (body.metrics ?? []) as GPMetric[],
    review: { freq: "weekly", weekday: reviewDay, startTime: null },
    unresolved: c.unresolved,
    warnings: c.warnings,
  };
}

/**
 * Regenerate a draft after profile changes while keeping what the user deliberately shaped:
 * user-edited / excluded items are carried over by key.
 */
export function regenerate(prev: GoalPlan, fresh: GoalPlan): GoalPlan {
  const keepT = new Map(prev.tasks.filter((t) => t.userEdited || t.excluded).map((t) => [t.key, t]));
  const keepR = new Map(prev.routines.filter((r) => r.userEdited || r.excluded).map((r) => [r.key, r]));
  const exclM = new Set(prev.milestones.filter((m) => m.excluded).map((m) => m.key));
  return {
    ...fresh,
    tasks: [...fresh.tasks.map((t) => keepT.get(t.key) ?? t), ...[...keepT.values()].filter((t) => t.userEdited && !fresh.tasks.some((x) => x.key === t.key))],
    routines: fresh.routines.map((r) => keepR.get(r.key) ?? r),
    milestones: fresh.milestones.map((m) => (exclM.has(m.key) ? { ...m, excluded: true } : m)),
  };
}

/** Which profile keys only affect scheduling (no need to rebuild plan content). */
export const SCHEDULE_ONLY_KEYS = new Set(["preferredDays", "preferredTime", "reviewDay", "obstacles"]);
