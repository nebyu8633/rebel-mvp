/**
 * Deterministic planning engine (no AI). Produces a reviewable PlanProposal from
 * transparent templates. Every number it uses is either user-entered or a labelled assumption.
 */
import type { PlanInput, PlanMilestone, PlanProposal, PlanTask, SuggestedHabit } from "./schema";
import { addDays, addMonths, diffDays, minDate, startOfMonth, startOfWeek, maxDate } from "../dates";
import { formatILS, requiredMonthlyContribution, monthsToSave } from "../finance";

export class PlanInputError extends Error {
  constructor(public missing: string[]) {
    super(`חסר מידע כדי לבנות תוכנית: ${missing.join(", ")}`);
  }
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function splitWindow(start: string, end: string, parts: number): string[] {
  const total = Math.max(parts, diffDays(start, end));
  return Array.from({ length: parts }, (_, i) => addDays(start, Math.round((total * (i + 1)) / parts)));
}

let seq = 0;
const k = (p: string) => `${p}${++seq}`;

function task(
  title: string,
  durationMinutes: number,
  deadline: string,
  priority: PlanTask["priority"],
  rationale: string,
  dependsOn: string[] = [],
): PlanTask {
  return { key: k("t"), title, durationMinutes, deadline, priority, rationale, dependsOn };
}

function monthly(start: string, end: string, titles: (i: number, month: string) => string, max = 3) {
  const out: PlanMilestone["monthlyObjectives"] = [];
  for (let m = startOfMonth(start), i = 0; m <= end && i < max; m = addMonths(m, 1), i++) out.push({ month: m, title: titles(i, m) });
  return out;
}

function weekly(start: string, end: string, titles: (i: number) => string, max = 4) {
  const out: PlanMilestone["weeklyObjectives"] = [];
  for (let w = startOfWeek(start), i = 0; w <= end && i < max; w = addDays(w, 7), i++) out.push({ weekStart: w, title: titles(i) });
  return out;
}

interface Built {
  summary: string;
  facts: string[];
  userProvided: string[];
  assumptions: string[];
  recommendations: string[];
  warnings: string[];
  milestones: PlanMilestone[];
  habits: SuggestedHabit[];
}

function commonUserProvided(input: PlanInput): string[] {
  const u: string[] = [`מטרה: ${input.title}`, `תאריך יעד: ${input.targetDate}`];
  if (input.currentState) u.push(`מצב נוכחי: ${input.currentState}`);
  if (input.desiredOutcome) u.push(`תוצאה רצויה: ${input.desiredOutcome}`);
  if (input.weeklyMinutes != null) u.push(`זמן זמין למטרה: ${input.weeklyMinutes} דקות בשבוע`);
  if (input.constraints) u.push(`אילוצים: ${input.constraints}`);
  if (input.commitments) u.push(`התחייבויות קבועות: ${input.commitments}`);
  return u;
}

function motorcycle(input: PlanInput, today: string): Built {
  const d = input.data;
  const missing: string[] = [];
  if (!str(d.model)) missing.push("דגם רצוי");
  if (num(d.price) == null) missing.push("מחיר משוער");
  if (num(d.savedSoFar) == null) missing.push("חיסכון קיים למטרה");
  if (num(d.monthlySavingCapacity) == null) missing.push("יכולת חיסכון חודשית");
  if (missing.length) throw new PlanInputError(missing);

  const price = num(d.price)!;
  const extras = (num(d.licenseCost) ?? 0) + (num(d.gearCost) ?? 0) + (num(d.insuranceYearly) ?? 0) + (num(d.otherCosts) ?? 0);
  const total = price + extras;
  const saved = num(d.savedSoFar)!;
  const capacity = num(d.monthlySavingCapacity)!;
  const remaining = Math.max(0, total - saved);
  const start = maxDate(today, input.startDate);
  const months = Math.max(1, Math.round(diffDays(start, input.targetDate) / 30.4));
  const neededMonthly = Math.ceil(remaining / months);
  const toSave = monthsToSave(remaining, capacity);
  const hasLicense = str(d.hasLicense) === "yes";

  const warnings: string[] = [];
  if (capacity < neededMonthly)
    warnings.push(
      `כדי להגיע ל-${formatILS(total)} עד ${input.targetDate} צריך לחסוך כ-${formatILS(neededMonthly)} בחודש, יותר מיכולת החיסכון שהזנת (${formatILS(capacity)}). ${toSave ? `בקצב הנוכחי זה ייקח כ-${toSave} חודשים.` : ""}`,
    );
  const missingCosts = [
    num(d.licenseCost) == null && !hasLicense ? "עלות רישיון" : null,
    num(d.gearCost) == null ? "ציוד מגן" : null,
    num(d.insuranceYearly) == null ? "ביטוח" : null,
  ].filter(Boolean) as string[];
  if (missingCosts.length) warnings.push(`עלויות שעדיין לא הוזנו ולכן לא נכללו ביעד: ${missingCosts.join(", ")}.`);

  const [m1End, m2End, m3End, m4End] = splitWindow(start, input.targetDate, 4);
  const ms: PlanMilestone[] = [];

  const quotes = task("לקבל 3 הצעות מחיר לביטוח עבור הדגם הרצוי", 60, minDate(addDays(start, 14), m1End), "medium", "עלות הביטוח משפיעה ישירות על סכום היעד.");
  const research = task(`לבדוק 3 מודעות/סוכנויות ל-${str(d.model)} ולרשום מחירים`, 45, minDate(addDays(start, 7), m1End), "high", "מחיר מדויק הופך את יעד החיסכון לאמין.");
  const budget = task("לעדכן את סכום היעד באפליקציה לפי המחירים שנמצאו", 15, minDate(addDays(start, 16), m1End), "medium", "יעד מעודכן = חישוב חודשי נכון.", [research.key, quotes.key]);
  const standing = task(`להגדיר העברה חודשית קבועה של ${formatILS(Math.min(capacity, neededMonthly) || capacity)} לחיסכון`, 20, minDate(addDays(start, 10), m1End), "high", "אוטומציה מונעת דילוג על חודשים.");
  ms.push({
    key: k("m"),
    title: "תמחור מדויק והתחלת חיסכון",
    description: "לקבע את העלות האמיתית ולהתחיל לחסוך באופן קבוע.",
    targetDate: m1End,
    monthlyObjectives: monthly(start, m1End, (i) => (i === 0 ? "תמחור מלא של האופנוע, הביטוח והציוד" : `לחסוך ${formatILS(Math.min(capacity, neededMonthly))}`), 2),
    weeklyObjectives: weekly(start, m1End, (i) => ["סקר מחירים לדגם", "הצעות ביטוח", "הגדרת חיסכון אוטומטי", "עדכון יעד"][i] ?? "מעקב חיסכון"),
    tasks: [research, quotes, budget, standing],
  });

  if (!hasLicense) {
    const req = task("לברר את דרישות הרישיון לדרגה המתאימה לדגם (משרד התחבורה)", 30, minDate(addDays(start, 7), m2End), "high", "הרישיון הוא תנאי לרכישה ולביטוח.");
    const school = task("להשוות 2-3 בתי ספר לנהיגה ולקבוע שיעור ראשון", 60, minDate(addDays(start, 21), m2End), "medium", "לוח זמנים לשיעורים קובע מתי אפשר לעלות לטסט.", [req.key]);
    const theory = task("לקבוע תאריך למבחן תיאוריה (אם נדרש)", 20, minDate(addDays(start, 30), m2End), "medium", "תיאוריה היא שלב ראשון במסלול.", [req.key]);
    ms.push({
      key: k("m"),
      title: "רישיון נהיגה לאופנוע",
      description: "השלמת תהליך הרישיון במקביל לחיסכון.",
      targetDate: m2End,
      monthlyObjectives: monthly(start, m2End, (i) => ["בירור דרישות ובחירת בית ספר", "שיעורים ותיאוריה", "טסט מעשי"][i] ?? "שיעורים"),
      weeklyObjectives: weekly(start, m2End, (i) => ["בירור דרישות", "השוואת בתי ספר", "קביעת תיאוריה", "שיעור ראשון"][i] ?? "שיעורים"),
      tasks: [req, school, theory],
    });
  }

  ms.push({
    key: k("m"),
    title: `חיסכון ${formatILS(total)}`,
    description: `נותרו ${formatILS(remaining)} לחיסכון. עדכון יתרה חודשי באפליקציה.`,
    targetDate: m3End,
    monthlyObjectives: monthly(start, m3End, () => `להפקיד ${formatILS(Math.min(capacity, neededMonthly))} ולעדכן יתרה`),
    weeklyObjectives: [],
    tasks: [task("לעדכן יתרת חיסכון באפליקציה", 5, minDate(addDays(start, 30), m3End), "medium", "מעקב מראה אם הקצב מספיק.")],
  });

  const gear = task("למדוד ולבחור ציוד מגן (קסדה, כפפות, מעיל)", 120, addDays(m4End, -14) > start ? addDays(m4End, -14) : m4End, "medium", "ציוד מגן הוא חלק מהעלות ומהבטיחות.");
  const inspect = task("לתאם בדיקה מקצועית לאופנוע לפני רכישה", 60, addDays(m4End, -7) > start ? addDays(m4End, -7) : m4End, "high", "בדיקה מונעת הפתעות יקרות.");
  const buy = task("לבצע רכישה, העברת בעלות וביטוח", 180, m4End, "high", "השלמת המטרה.", [inspect.key, gear.key]);
  ms.push({
    key: k("m"),
    title: "רכישת האופנוע",
    description: "ציוד, בדיקה, ביטוח ורכישה.",
    targetDate: m4End,
    monthlyObjectives: [],
    weeklyObjectives: [],
    tasks: [gear, inspect, buy],
  });

  return {
    summary: `תוכנית לרכישת ${str(d.model)} עד ${input.targetDate}: יעד כולל ${formatILS(total)}, נותרו ${formatILS(remaining)} (${formatILS(neededMonthly)} בחודש).`,
    facts: ["רכיבה על אופנוע בישראל מחייבת רישיון בדרגה המתאימה לנפח/הספק, וביטוח חובה."],
    userProvided: [
      ...commonUserProvided(input),
      `דגם: ${str(d.model)}`,
      `מחיר משוער: ${formatILS(price)}`,
      `חיסכון קיים: ${formatILS(saved)}`,
      `יכולת חיסכון חודשית: ${formatILS(capacity)}`,
      hasLicense ? "יש רישיון מתאים" : "אין עדיין רישיון מתאים (או לא צוין)",
    ],
    assumptions: [
      "החיסכון לאופנוע נשמר בנפרד מתיק ההשקעות ואינו מניב תשואה.",
      "יעד החיסכון כולל רק עלויות שהוזנו; תחזוקה שוטפת אינה חלק מסכום הרכישה.",
      "חלוקת אבני הדרך לאורך התקופה היא הצעה שווה ולא מבוססת על לוחות זמנים של בתי ספר.",
    ],
    recommendations: ["לעדכן את הסכומים לאחר קבלת הצעות מחיר אמיתיות.", "לשקול אופנוע יד שנייה עם בדיקה מקצועית."],
    warnings,
    milestones: ms,
    habits: [],
  };
}

function weight(input: PlanInput, today: string): Built {
  const d = input.data;
  const current = num(d.currentWeight);
  const gain = num(d.targetGain) ?? 10;
  if (current == null) throw new PlanInputError(["משקל נוכחי (לאישור)"]);
  const start = maxDate(today, input.startDate);
  const quarters = splitWindow(start, input.targetDate, 4);
  const perQ = Math.round((gain / 4) * 10) / 10;
  const weeks = Math.max(1, diffDays(start, input.targetDate) / 7);
  const perWeek = Math.round((gain / weeks) * 100) / 100;
  const t1 = task("לבחור 5-7 ארוחות שאוהבים ולהוסיף אותן לספריית הארוחות", 45, addDays(start, 4), "high", "תפריט שאוהבים קל יותר לשמור לאורך זמן.");
  const t2 = task("לבנות ולאשר תפריט שבועי ראשון", 30, addDays(start, 6), "high", "התפריט המאושר מייצר את רשימת הקניות.", [t1.key]);
  const t3 = task("שקילת בסיס ורישום באפליקציה", 5, addDays(start, 2), "high", "נקודת התחלה מדויקת למעקב.");
  const t4 = task("לבחור תוכנית אימוני כוח (מאמן/אפליקציה) ולקבוע ימים קבועים", 60, addDays(start, 10), "medium", "אימוני כוח עוזרים שהעלייה תהיה במסת שריר ולא רק בשומן.");
  const t5 = task("לשקול פגישה עם דיאטן/ית קליני/ת או רופא/ה", 30, addDays(start, 21), "medium", "התאמה אישית ובטיחות — במיוחד אם יש מצב רפואי.");
  return {
    summary: `עלייה הדרגתית של כ-${gain} ק״ג (כ-${perWeek} ק״ג בשבוע בממוצע) עד ${input.targetDate}, דרך תפריט קבוע, הכנת אוכל ואימוני כוח.`,
    facts: ["קצב העלייה משתנה מאדם לאדם; התוכנית אינה מבטיחה תוצאה."],
    userProvided: [...commonUserProvided(input), `משקל נוכחי שאושר: ${current} ק״ג`, `יעד עלייה: ${gain} ק״ג`],
    assumptions: [
      `חלוקה שווה של כ-${perQ} ק״ג לכל רבעון — הנחה לתכנון בלבד.`,
      "התוכנית אינה קובעת כמויות קלוריות או תפריט — את הארוחות בוחרים ומאשרים בעצמך.",
    ],
    recommendations: [
      "שקילה פעם בשבוע באותו יום ושעה; לבחון מגמה ולא שקילה בודדת.",
      "אם יש מצב רפואי, הפרעת אכילה בעבר או תרופות — להתייעץ עם איש מקצוע לפני שינוי תזונה.",
    ],
    warnings: [],
    milestones: quarters.map((q, i) => ({
      key: k("m"),
      title: `${Math.round((current + perQ * (i + 1)) * 10) / 10} ק״ג`,
      description: i === 0 ? "בניית שגרת אוכל, הכנה ואימונים." : "שמירה על השגרה והתאמות לפי המגמה.",
      targetDate: q,
      monthlyObjectives: i === 0 ? monthly(start, q, (j) => ["שגרת תפריט שבועי + הכנה", "3 אימוני כוח בשבוע", "בחינת מגמה והתאמת כמויות"][j] ?? "שמירה על שגרה") : [],
      weeklyObjectives: i === 0 ? weekly(start, q, (j) => ["שקילת בסיס ותפריט ראשון", "קניות והכנה ראשונה", "קביעת ימי אימון", "סיכום חודש ראשון"][j] ?? "שגרה") : [],
      tasks: i === 0 ? [t3, t1, t2, t4, t5] : [task("לבחון את גרף המשקל ולעדכן את התפריט לפי הצורך", 20, q, "medium", "התאמה לפי מגמה בפועל.")],
    })),
    habits: [
      { title: "שקילה שבועית", timesPerWeek: 1, rationale: "מעקב מגמה." },
      { title: "אימון כוח", timesPerWeek: 3, rationale: "תמיכה בעלייה במסת שריר." },
    ],
  };
}

function portfolio(input: PlanInput, today: string): Built {
  const d = input.data;
  const target = num(d.target) ?? 30000;
  const current = num(d.currentValue);
  const start = maxDate(today, input.startDate);
  const months = Math.max(1, Math.round(diffDays(start, input.targetDate) / 30.4));
  const quarters = splitWindow(start, input.targetDate, 4);
  const record = task("לרשום את שווי התיק הנוכחי באפליקציה", 10, addDays(start, 2), "high", "בלי ערך התחלתי אי אפשר לחשב את ההפקדה הנדרשת.");
  const warnings: string[] = [];
  let summary: string;
  const assumptions = [
    "תרחיש ניטרלי של 5% תשואה שנתית משמש להמחשה בלבד; תשואה עלולה להיות שלילית.",
    "היעד הוא שווי שוק של התיק ולא סכום ההפקדות.",
  ];
  let monthlyNeutral: number | null = null;
  if (current == null) {
    warnings.push("שווי התיק הנוכחי לא הוזן — לא ניתן לחשב הפקדה חודשית נדרשת.");
    summary = `הגעה לשווי תיק של ${formatILS(target)} עד ${input.targetDate}. השלב הראשון: לרשום את שווי התיק הנוכחי.`;
  } else {
    monthlyNeutral = requiredMonthlyContribution(current, target, months, 0.05);
    const zero = requiredMonthlyContribution(current, target, months, 0);
    summary = `מ-${formatILS(current)} ל-${formatILS(target)} ב-${months} חודשים: כ-${formatILS(zero)} בחודש ללא תשואה, או כ-${formatILS(monthlyNeutral)} בחודש בתרחיש ניטרלי (5%, הנחה).`;
  }
  const decide = task(
    monthlyNeutral != null ? `להחליט על סכום הפקדה חודשי (מומלץ לבדוק מול ${formatILS(monthlyNeutral)})` : "להחליט על סכום הפקדה חודשי",
    30,
    addDays(start, 7),
    "high",
    "הפקדה קבועה היא הגורם שבשליטתך.",
    [record.key],
  );
  const standing = task("להגדיר הוראת קבע/הפקדה חודשית אצל הגוף המנהל", 20, addDays(start, 14), "high", "אוטומציה = עקביות.", [decide.key]);
  return {
    summary,
    facts: ["תשואות עבר אינן מבטיחות תשואות עתידיות.", "האפליקציה אינה מבצעת פעולות ואינה מחוברת לחשבון השקעות."],
    userProvided: [...commonUserProvided(input), current != null ? `שווי תיק נוכחי: ${formatILS(current)}` : "שווי תיק נוכחי: לא הוזן"],
    assumptions,
    recommendations: ["לעדכן שווי תיק פעם בחודש ולרשום הפקדות בנפרד, כדי להבחין בין הפקדות לשינויי שוק.", "לשקול ייעוץ השקעות מורשה לגבי אפיק ההשקעה."],
    warnings,
    milestones: quarters.map((q, i) => ({
      key: k("m"),
      title: i === 3 ? `שווי תיק ${formatILS(target)}` : `סקירה רבעונית ${i + 1}`,
      description: i === 0 ? "בסיס נתונים, החלטה על הפקדה ואוטומציה." : "בדיקת שווי מול המסלול והתאמת הפקדה.",
      targetDate: q,
      monthlyObjectives: i === 0 ? monthly(start, q, (j) => (j === 0 ? "נתוני בסיס והוראת קבע" : "הפקדה + עדכון שווי")) : [],
      weeklyObjectives: i === 0 ? weekly(start, q, (j) => ["רישום שווי נוכחי", "החלטה על הפקדה", "הגדרת הוראת קבע", "עדכון ראשון"][j] ?? "מעקב") : [],
      tasks: i === 0 ? [record, decide, standing] : [task("לעדכן שווי תיק ולבדוק מול הנדרש", 20, q, "medium", "מאפשר לתקן מוקדם אם יש פער.")],
    })),
    habits: [{ title: "עדכון שווי תיק והפקדות", timesPerWeek: 1, rationale: "מעקב חודשי/שבועי מבדיל בין הפקדות לשינויי שוק." }],
  };
}

function custom(input: PlanInput, today: string): Built {
  const start = maxDate(today, input.startDate);
  const ends = splitWindow(start, input.targetDate, 4);
  const names = ["הגדרה ומחקר", "בניית בסיס", "ביצוע מרכזי", "השלמה וסיכום"];
  const t1 = task(`לנסח במשפט אחד איך נראית הצלחה ב"${input.title}"`, 20, addDays(start, 3), "high", "הגדרה ברורה מאפשרת למדוד התקדמות.");
  const t2 = task("לרשום את 3 הצעדים הראשונים ומה חסר כדי להתחיל", 30, addDays(start, 6), "high", "צעדים קטנים מורידים חסמים.", [t1.key]);
  const t3 = task("לשריין זמן קבוע בשבוע ביומן למטרה", 15, addDays(start, 7), "medium", "זמן משוריין = התקדמות עקבית.");
  return {
    summary: `תבנית בסיסית ל"${input.title}" ב-4 שלבים עד ${input.targetDate}. מומלץ לערוך את המשימות לפי הפרטים שלך.`,
    facts: [],
    userProvided: commonUserProvided(input),
    assumptions: ["החלוקה ל-4 שלבים שווים היא תבנית כללית ולא מבוססת על ניתוח של המטרה הספציפית."],
    recommendations: ["לחבר מפתח AI לקבלת פירוק מותאם יותר, או לערוך ידנית את אבני הדרך."],
    warnings: [],
    milestones: ends.map((e, i) => ({
      key: k("m"),
      title: names[i],
      description: "",
      targetDate: e,
      monthlyObjectives: i === 0 ? monthly(start, e, () => "הגדרה וצעדים ראשונים", 1) : [],
      weeklyObjectives: i === 0 ? weekly(start, e, (j) => ["הגדרת הצלחה", "צעדים ראשונים", "שריון זמן", "סיכום"][j] ?? "") : [],
      tasks: i === 0 ? [t1, t2, t3] : [task(`לתכנן את שלב "${names[i]}"`, 30, addDays(ends[i - 1], 3), "medium", "פירוק השלב הבא כשהוא מתקרב.")],
    })),
    habits: [],
  };
}

export function fallbackPlan(input: PlanInput, today: string): PlanProposal {
  seq = 0;
  const builders = { motorcycle, weight, portfolio, custom } as const;
  const built = builders[input.kind](input, today);
  if (input.weeklyMinutes != null) {
    const firstMonthMinutes = built.milestones
      .flatMap((m) => m.tasks)
      .filter((t) => t.deadline <= addDays(today, 28))
      .reduce((s, t) => s + t.durationMinutes, 0);
    if (firstMonthMinutes > input.weeklyMinutes * 4)
      built.warnings.push(
        `המשימות לחודש הראשון דורשות כ-${firstMonthMinutes} דקות, יותר מ-${input.weeklyMinutes * 4} הדקות שהגדרת לחודש. כדאי לדחות או להסיר חלק.`,
      );
  }
  const proposal: PlanProposal = { ...built };
  if (input.regenerateMilestoneKey && input.previous) {
    // Deterministic regeneration: replace the requested milestone with the template's milestone at the same index.
    const idx = input.previous.milestones.findIndex((m) => m.key === input.regenerateMilestoneKey);
    const fresh = built.milestones[Math.min(Math.max(idx, 0), built.milestones.length - 1)];
    const milestones = input.previous.milestones.map((m) => {
      if (m.key !== input.regenerateMilestoneKey || !fresh) return m;
      const rk = (key: string) => `${m.key}_${key}`;
      return {
        ...fresh,
        key: m.key,
        tasks: fresh.tasks.map((t) => ({ ...t, key: rk(t.key), dependsOn: t.dependsOn.map(rk) })),
      };
    });
    return { ...input.previous, milestones };
  }
  return proposal;
}
