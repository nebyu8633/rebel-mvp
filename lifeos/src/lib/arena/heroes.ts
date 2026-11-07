/**
 * Hero catalog — 6 island factions × 3 heroes. Abilities are DATA built from the effect kinds in
 * types.ts, so a new hero is a new entry here; the engine never changes.
 *
 * Balance: competitive stats are normalized by ROLE, not by rarity. Rarity changes the kit
 * (more interesting combinations), never the raw numbers — a Legendary hero is not stronger
 * than a Common one. Budgets per slot are checked by the balance tests.
 */
import type { Ability, Effect, HeroDef, Payload, Rarity, RegionId, Role, Slot } from "./types";

export const ROLE_STATS: Record<Role, { hp: number; speed: number; radius: number }> = {
  tank: { hp: 1200, speed: 5.0, radius: 0.85 },
  damage: { hp: 820, speed: 6.1, radius: 0.65 },
  support: { hp: 900, speed: 5.6, radius: 0.65 },
};
export const MAX_ENERGY = 100;
export const ENERGY_REGEN = 9; // per second, active hero
export const ENERGY_REGEN_BENCH = 6; // inactive heroes
export const BENCH_HEAL = 8; // hp/s for heroes waiting on the bench
export const SWITCH_CD = 2.5;

export const ROLE_LABEL: Record<Role, string> = { tank: "מגן", damage: "תוקף", support: "תומך" };
export const RARITY_LABEL: Record<Rarity, string> = { common: "רגיל", rare: "נדיר", epic: "אפי", legendary: "אגדי" };
export const SLOT_LABEL: Record<Slot, string> = { basic: "בסיסית", special: "מיוחדת", defense: "הגנה", ultimate: "אולטימטיבית" };
export const REGION_NAME: Record<RegionId, string> = {
  wealth: "אי העושר",
  health: "אי הבריאות",
  knowledge: "אי הידע",
  career: "עיר הקריירה",
  social: "כפר החברים",
  mind: "מקדש התודעה",
};

// ───────── compact builders ─────────
const ab = (slot: Slot, id: string, name: string, desc: string, o: { cd: number; cost?: number; range?: number; cast?: number }, ...effects: Effect[]): Ability => ({
  id,
  name,
  slot,
  desc,
  cd: o.cd,
  cost: o.cost ?? 0,
  range: o.range ?? 8,
  castTime: o.cast ?? 0.15,
  effects,
});
const shot = (damage: number, o: { speed?: number; range?: number; radius?: number; pierce?: boolean; count?: number; spread?: number; extra?: Payload } = {}): Effect => ({
  kind: "projectile",
  speed: o.speed ?? 22,
  range: o.range ?? 11,
  radius: o.radius ?? 0.35,
  pierce: o.pierce,
  count: o.count,
  spread: o.spread,
  payload: { damage, ...o.extra },
});
const blast = (at: "self" | "aim", radius: number, target: "enemies" | "allies" | "self" | "team", payload: Payload, delay?: number): Effect => ({ kind: "area", at, radius, target, payload, delay });
const cone = (range: number, angle: number, payload: Payload): Effect => ({ kind: "cone", range, angle, payload });
const dash = (distance: number, payload?: Payload, back?: boolean): Effect => ({ kind: "dash", distance, payload, back });
const zone = (at: "self" | "aim", radius: number, duration: number, target: "enemies" | "allies" | "team", payload: Payload, tick = 0.5): Effect => ({ kind: "zone", at, radius, duration, tick, target, payload });
const self = (payload: Payload): Effect => ({ kind: "self", payload });

type Def = Omit<HeroDef, "abilities"> & { abilities: Ability[] };
const hero = (d: Def): HeroDef => ({ ...d, abilities: Object.fromEntries(d.abilities.map((a) => [a.slot, a])) as HeroDef["abilities"] });

export const HEROES: HeroDef[] = [
  // ───── WEALTH — protection, resources, shields ─────
  hero({
    id: "aegis", name: "אגיס", title: "שומר הכספת", region: "wealth", role: "tank", rarity: "common",
    story: "נפח מטבעות שהפך את המגן הראשון שלו מחסכונות של שנה. מאמין שכל דבר יקר צריך חומה.",
    look: { body: "#6b5a2e", trim: "#d4a73c", glow: "#f6d77a", weapon: "shield" },
    abilities: [
      ab("basic", "aegis-bash", "מכת מגן", "מכה קצרת טווח בקשת רחבה.", { cd: 0.7, range: 2.6 }, cone(2.6, 1.6, { damage: 70 })),
      ab("special", "aegis-wall", "חומת זהב", "מגן לך ולבני הצוות הקרובים.", { cd: 9, cost: 30, cast: 0.3 }, blast("self", 5, "team", { shield: 220, shieldDur: 4 })),
      ab("defense", "aegis-plate", "שריון מטבעות", "מפחית נזק ב-50% למשך 3 שניות.", { cd: 11, cost: 20 }, self({ status: { type: "guard", dur: 3, value: 0.5 } })),
      ab("ultimate", "aegis-vault", "הכספת", "אזור שמגן על בני הצוות ומאט אויבים.", { cd: 40, cost: 60, cast: 0.5 }, zone("self", 5, 4, "team", { shield: 60, shieldDur: 1.5 }), zone("self", 5, 4, "enemies", { status: { type: "slow", dur: 0.8, value: 0.4 } })),
    ],
  }),
  hero({
    id: "lira", name: "לירה", title: "המשקיעה", region: "wealth", role: "damage", rarity: "rare",
    story: "סוחרת מטבעות שמשליכה אותם בדיוק של מי שחישבה כל צעד. הכסף שלה תמיד עובד.",
    look: { body: "#3c4f6e", trim: "#d4a73c", glow: "#ffe39a", weapon: "fan" },
    abilities: [
      ab("basic", "lira-coin", "מטבע", "מטבע מהיר לטווח בינוני.", { cd: 0.5, range: 12 }, shot(62, { range: 12 })),
      ab("special", "lira-compound", "ריבית דריבית", "שלושה מטבעות בבת אחת.", { cd: 7, cost: 25, range: 11 }, shot(55, { count: 3, spread: 0.22, range: 11 })),
      ab("defense", "lira-hedge", "גידור", "קפיצה לאחור ומהירות לשנייה.", { cd: 10, cost: 15 }, dash(5, undefined, true), self({ status: { type: "haste", dur: 1.2, value: 0.35 } })),
      ab("ultimate", "lira-rain", "גשם זהב", "פגיעה מושהית באזור המטרה.", { cd: 40, cost: 60, range: 10, cast: 0.5 }, blast("aim", 4, "enemies", { damage: 360 }, 0.8)),
    ],
  }),
  hero({
    id: "croesus", name: "קרסוס", title: "הגזבר הגדול", region: "wealth", role: "support", rarity: "legendary",
    story: "שומר אוצר עתיק שמחלק משאבים בחוכמה — ליד שלו, הצוות אף פעם לא נשאר בלי אנרגיה.",
    look: { body: "#5a3c6e", trim: "#f3d488", glow: "#fff1b8", weapon: "orb" },
    abilities: [
      ab("basic", "croesus-orb", "כדור אוצר", "כדור איטי שמחזיר מעט אנרגיה לך בפגיעה.", { cd: 0.6, range: 10 }, shot(58, { speed: 16, range: 10, radius: 0.5 })),
      ab("special", "croesus-dividend", "דיבידנד", "אנרגיה וריפוי לבני הצוות סביבך.", { cd: 9, cost: 25, cast: 0.3 }, blast("self", 6, "team", { energy: 30, heal: 150 })),
      ab("defense", "croesus-reserve", "קרן חירום", "מגן על עצמך.", { cd: 12, cost: 20 }, self({ shield: 260, shieldDur: 3 })),
      ab("ultimate", "croesus-treasury", "האוצר נפתח", "אזור שמרפא בני צוות ומגביר את הנזק שלהם.", { cd: 42, cost: 60, range: 8, cast: 0.5 }, zone("aim", 4.5, 5, "team", { heal: 45, status: { type: "power", dur: 1, value: 0.2 } })),
    ],
  }),

  // ───── HEALTH — healing, endurance, recovery ─────
  hero({
    id: "vita", name: "ויטה", title: "מרפאת המעיינות", region: "health", role: "support", rarity: "common",
    story: "גדלה ליד מעיינות ההתאוששות. יודעת שגוף חזק נבנה גם במנוחה.",
    look: { body: "#2f6b4f", trim: "#ffb199", glow: "#b9ffd6", weapon: "staff" },
    abilities: [
      ab("basic", "vita-spark", "ניצוץ חיים", "קליע עדין לטווח בינוני.", { cd: 0.55, range: 10 }, shot(48, { range: 10 })),
      ab("special", "vita-spring", "מעיין", "ריפוי לבני הצוות סביבך.", { cd: 8, cost: 25, cast: 0.3 }, blast("self", 6, "team", { heal: 170 })),
      ab("defense", "vita-breath", "נשימה עמוקה", "ריפוי עצמי והגנה קלה.", { cd: 11, cost: 20 }, self({ heal: 120, status: { type: "guard", dur: 2, value: 0.25 } })),
      ab("ultimate", "vita-grove", "חורשת ההתאוששות", "אזור ריפוי גדול.", { cd: 40, cost: 60, range: 8, cast: 0.5 }, zone("aim", 5, 5, "team", { heal: 60 })),
    ],
  }),
  hero({
    id: "titan", name: "טיטאן", title: "אלוף הסיבולת", region: "health", role: "tank", rarity: "rare",
    story: "מתאמן בהרים כל בוקר. לא הכי מהיר — אבל אף פעם לא נופל ראשון.",
    look: { body: "#6e3a2f", trim: "#e46b4f", glow: "#ffd0b0", weapon: "hammer" },
    abilities: [
      ab("basic", "titan-swing", "הנפה", "מכת פטיש קצרה.", { cd: 0.75, range: 2.8 }, cone(2.8, 1.4, { damage: 76 })),
      ab("special", "titan-charge", "הסתערות", "דהירה קדימה שפוגעת ודוחפת.", { cd: 8, cost: 25 }, dash(6, { damage: 90, knock: 3 })),
      ab("defense", "titan-endure", "סיבולת", "מגן גדול לזמן קצר.", { cd: 11, cost: 20 }, self({ shield: 260, shieldDur: 3 })),
      ab("ultimate", "titan-quake", "רעידת הר", "מכה באזור סביבך שמשהה אויבים.", { cd: 42, cost: 60, cast: 0.6 }, blast("self", 5, "enemies", { damage: 170, status: { type: "stun", dur: 0.8 } })),
    ],
  }),
  hero({
    id: "phoenix", name: "פניקס", title: "הלהבה המתחדשת", region: "health", role: "damage", rarity: "legendary",
    story: "נפלה, קמה, ונפלה שוב — וכל פעם חזרה חזקה יותר. האש שלה מרפאת אותה עצמה.",
    look: { body: "#7a2f22", trim: "#ff9c5a", glow: "#ffd58a", weapon: "blade" },
    abilities: [
      ab("basic", "phoenix-ember", "גץ", "קליע אש מהיר.", { cd: 0.5, range: 11 }, shot(60)),
      ab("special", "phoenix-dive", "צלילה בוערת", "קפיצה קדימה ופיצוץ בנחיתה.", { cd: 8, cost: 25 }, dash(6), blast("self", 3, "enemies", { damage: 120 })),
      ab("defense", "phoenix-rebirth", "התחדשות", "ריפוי עצמי מהיר.", { cd: 12, cost: 25 }, self({ heal: 170 })),
      ab("ultimate", "phoenix-nova", "נובה", "שרשרת אש: טבעת נזק סביבך ואזור בוער.", { cd: 42, cost: 60, cast: 0.5 }, blast("self", 4, "enemies", { damage: 180 }), zone("self", 4, 3, "enemies", { damage: 40 })),
    ],
  }),

  // ───── KNOWLEDGE — tactics, revealing weaknesses ─────
  hero({
    id: "sage", name: "סייג׳", title: "חוקרת הכוכבים", region: "knowledge", role: "damage", rarity: "common",
    story: "בילתה לילות במצפה הכוכבים. רואה חולשות לפני שכל אחד אחר שם לב.",
    look: { body: "#2f4f9e", trim: "#a9c4ff", glow: "#d8e6ff", weapon: "tome" },
    abilities: [
      ab("basic", "sage-bolt", "קרן ידע", "קליע ארוך טווח.", { cd: 0.55, range: 13 }, shot(58, { range: 13, speed: 24 })),
      ab("special", "sage-insight", "תובנה", "חושפת את החולשות של אויבים באזור: +25% נזק עליהם.", { cd: 8, cost: 25, range: 11 }, blast("aim", 3.5, "enemies", { damage: 60, status: { type: "mark", dur: 4, value: 0.25 } })),
      ab("defense", "sage-blink", "הבזק", "שיגור קצר לכיוון הכוונה.", { cd: 9, cost: 15 }, dash(5)),
      ab("ultimate", "sage-comet", "כוכב שביט", "קליע גדול וחודר.", { cd: 40, cost: 60, range: 16, cast: 0.5 }, shot(300, { speed: 18, range: 16, radius: 0.9, pierce: true })),
    ],
  }),
  hero({
    id: "lumen", name: "לומן", title: "ספרן האור", region: "knowledge", role: "support", rarity: "rare",
    story: "שומר הספרייה הגדולה. מאמין שהנשק הכי חזק של צוות הוא מידע משותף.",
    look: { body: "#3a5a7a", trim: "#9ee6f7", glow: "#e0fbff", weapon: "orb" },
    abilities: [
      ab("basic", "lumen-ray", "קרן אור", "קליע בינוני.", { cd: 0.55, range: 11 }, shot(56)),
      ab("special", "lumen-lecture", "הרצאה", "בני הצוות מקבלים מהירות ומגן קטן.", { cd: 9, cost: 25, cast: 0.3 }, blast("self", 6, "team", { shield: 160, shieldDur: 3, heal: 60, status: { type: "haste", dur: 2.5, value: 0.25 } })),
      ab("defense", "lumen-index", "אינדקס", "שתיקה לאויבים קרובים — לא יכולים להשתמש ביכולות.", { cd: 12, cost: 20 }, blast("self", 3.5, "enemies", { status: { type: "silence", dur: 1.5 } })),
      ab("ultimate", "lumen-archive", "הארכיון", "ריפוי מלא חלקי ואנרגיה לכל הצוות באזור.", { cd: 42, cost: 60, cast: 0.6 }, blast("self", 7, "team", { heal: 300, energy: 40 })),
    ],
  }),
  hero({
    id: "oracle", name: "אורקל", title: "שומר המצפה", region: "knowledge", role: "tank", rarity: "legendary",
    story: "ראה אלף קרבות בכוכבים לפני שהתרחשו. עומד תמיד במקום שבו המכה תגיע.",
    look: { body: "#26345e", trim: "#c9d6ea", glow: "#ffffff", weapon: "shield" },
    abilities: [
      ab("basic", "oracle-press", "לחץ", "מכה רחבה קצרת טווח.", { cd: 0.75, range: 2.7 }, cone(2.7, 1.5, { damage: 72 })),
      ab("special", "oracle-foresight", "חזון", "סימון ונזק לאויבים לפניך.", { cd: 8, cost: 25 }, cone(6, 0.9, { damage: 80, status: { type: "mark", dur: 3, value: 0.2 } })),
      ab("defense", "oracle-aegis", "צפי", "מגן והגנה קצרה.", { cd: 11, cost: 20 }, self({ shield: 200, shieldDur: 3, status: { type: "guard", dur: 2, value: 0.3 } })),
      ab("ultimate", "oracle-eclipse", "ליקוי", "שתיקה ועיכוב לכל האויבים סביבך.", { cd: 42, cost: 60, cast: 0.6 }, blast("self", 6, "enemies", { damage: 120, status: { type: "silence", dur: 2.2 } }), blast("self", 6, "enemies", { status: { type: "slow", dur: 2.2, value: 0.35 } })),
    ],
  }),

  // ───── CAREER — construction, structures, battlefield control ─────
  hero({
    id: "forge", name: "פורג׳", title: "הבנאי", region: "career", role: "tank", rarity: "common",
    story: "בנה את המשרד הראשון בעיר במו ידיו. כשצריך — בונה חומה באמצע הקרב.",
    look: { body: "#4a5563", trim: "#53b3c9", glow: "#9ee6f7", weapon: "hammer" },
    abilities: [
      ab("basic", "forge-strike", "מכת פטיש", "מכה קצרה.", { cd: 0.75, range: 2.6 }, cone(2.6, 1.4, { damage: 74 })),
      ab("special", "forge-wall", "חומה", "בונה חומה זמנית מול הכוונה.", { cd: 10, cost: 25, range: 6, cast: 0.3 }, { kind: "wall", length: 5, duration: 5 }),
      ab("defense", "forge-scaffold", "פיגום", "מגן והגנה.", { cd: 11, cost: 20 }, self({ shield: 240, shieldDur: 3 })),
      ab("ultimate", "forge-demolition", "הריסה מבוקרת", "פיצוץ מושהה גדול באזור המטרה שדוחף.", { cd: 42, cost: 60, range: 9, cast: 0.5 }, blast("aim", 4.5, "enemies", { damage: 280, knock: 4 }, 0.9)),
    ],
  }),
  hero({
    id: "mentor", name: "מנטור", title: "מנהלת הפרויקטים", region: "career", role: "support", rarity: "rare",
    story: "יודעת להוציא מכל אחד בצוות את המיטב. התוכנית שלה תמיד כוללת גיבוי.",
    look: { body: "#2e6f86", trim: "#d9dde3", glow: "#c9f3ff", weapon: "staff" },
    abilities: [
      ab("basic", "mentor-memo", "תזכיר", "קליע מהיר.", { cd: 0.55, range: 11 }, shot(56)),
      ab("special", "mentor-brief", "תדריך", "חיזוק נזק ואנרגיה לבני הצוות.", { cd: 9, cost: 25, cast: 0.3 }, blast("self", 6, "team", { energy: 25, heal: 90, status: { type: "power", dur: 4, value: 0.2 } })),
      ab("defense", "mentor-delegate", "האצלה", "קפיצה לאחור ומגן.", { cd: 10, cost: 15 }, dash(5, undefined, true), self({ shield: 120, shieldDur: 2 })),
      ab("ultimate", "mentor-office", "משרד בשטח", "אזור ריפוי שמאט אויבים.", { cd: 42, cost: 60, range: 8, cast: 0.5 }, zone("aim", 4.5, 5, "team", { heal: 45 }), zone("aim", 4.5, 5, "enemies", { status: { type: "slow", dur: 0.8, value: 0.3 } })),
    ],
  }),
  hero({
    id: "spire", name: "ספייר", title: "אדריכלית קו הרקיע", region: "career", role: "damage", rarity: "legendary",
    story: "תכננה את מגדל הקריירה. מכה מגבוה, מכל זווית, בדיוק של שרטוט.",
    look: { body: "#1d3c4a", trim: "#8fb8c9", glow: "#c9f3ff", weapon: "bow" },
    abilities: [
      ab("basic", "spire-arrow", "חץ", "חץ ארוך טווח.", { cd: 0.6, range: 14 }, shot(66, { range: 14, speed: 26 })),
      ab("special", "spire-piercing", "קורה", "חץ חודר.", { cd: 7, cost: 25, range: 14 }, shot(110, { range: 14, speed: 30, pierce: true })),
      ab("defense", "spire-zipline", "כבל", "קפיצה ארוכה.", { cd: 10, cost: 15 }, dash(7)),
      ab("ultimate", "spire-skyline", "קו רקיע", "מטח חצים מתמשך באזור.", { cd: 42, cost: 60, range: 11, cast: 0.5 }, zone("aim", 4, 3, "enemies", { damage: 70 }, 0.5)),
    ],
  }),

  // ───── SOCIAL — teamwork, buffs, supporting allies ─────
  hero({
    id: "harmony", name: "הרמוני", title: "לב הכפר", region: "social", role: "support", rarity: "common",
    story: "מכירה את כל תושבי הכפר בשמם. כשהיא שרה — כולם נלחמים טוב יותר.",
    look: { body: "#8a4a2f", trim: "#ffd09a", glow: "#ffe8c8", weapon: "fan" },
    abilities: [
      ab("basic", "harmony-note", "צליל", "קליע קל.", { cd: 0.55, range: 10 }, shot(54, { range: 10 })),
      ab("special", "harmony-chorus", "מקהלה", "ריפוי ומהירות לבני הצוות.", { cd: 9, cost: 25, cast: 0.3 }, blast("self", 6, "team", { heal: 150, status: { type: "haste", dur: 2, value: 0.2 } })),
      ab("defense", "harmony-embrace", "חיבוק", "מגן לך ולקרובים אליך.", { cd: 12, cost: 20 }, blast("self", 4, "team", { shield: 140, shieldDur: 3 })),
      ab("ultimate", "harmony-festival", "פסטיבל", "כל הצוות באזור: נזק מוגבר וריפוי.", { cd: 42, cost: 60, cast: 0.6 }, blast("self", 8, "team", { heal: 160, status: { type: "power", dur: 5, value: 0.25 } })),
    ],
  }),
  hero({
    id: "rally", name: "ראלי", title: "קפטן הקבוצה", region: "social", role: "damage", rarity: "rare",
    story: "מתחילה את המהלך, ואז דואגת שכולם יצטרפו. מהירה ולא נשארת לבד.",
    look: { body: "#c0582f", trim: "#f2c14e", glow: "#ffe0a0", weapon: "blade" },
    abilities: [
      ab("basic", "rally-slash", "חתך", "מכה מהירה קצרת טווח.", { cd: 0.45, range: 2.4 }, cone(2.6, 1.4, { damage: 66 })),
      ab("special", "rally-leap", "זינוק", "קפיצה שפוגעת באויבים בדרך.", { cd: 7, cost: 20 }, dash(6.5, { damage: 130 })),
      ab("defense", "rally-huddle", "התכנסות", "מגן קטן לך ולבני הצוות.", { cd: 11, cost: 20 }, blast("self", 4, "team", { shield: 110, shieldDur: 2.5 })),
      ab("ultimate", "rally-cheer", "קריאת קרב", "חיזוק לכל הצוות וסערת מכות סביבך.", { cd: 40, cost: 60, cast: 0.4 }, blast("self", 7, "team", { status: { type: "power", dur: 4, value: 0.3 } }), blast("self", 3.5, "enemies", { damage: 180 })),
    ],
  }),
  hero({
    id: "bastion", name: "בסטיון", title: "שומר השער", region: "social", role: "tank", rarity: "legendary",
    story: "מגן על הכפר כבר שלושה דורות. החומה הכי חזקה היא אנשים שעומדים יחד.",
    look: { body: "#5a3a22", trim: "#e59a4a", glow: "#ffd8a8", weapon: "shield" },
    abilities: [
      ab("basic", "bastion-bash", "דחיפה", "מכה רחבה.", { cd: 0.75, range: 2.7 }, cone(2.7, 1.6, { damage: 70 })),
      ab("special", "bastion-link", "שרשרת", "מגן גדול לבני הצוות סביבך (לא לך).", { cd: 9, cost: 25, cast: 0.3 }, blast("self", 6, "allies", { shield: 300, shieldDur: 4 })),
      ab("defense", "bastion-hold", "עמידה", "הגנה חזקה לשנייה וחצי.", { cd: 11, cost: 20 }, self({ status: { type: "guard", dur: 1.6, value: 0.7 } })),
      ab("ultimate", "bastion-gate", "השער", "משהה אויבים לפניך ומגן על הצוות.", { cd: 42, cost: 60, cast: 0.6 }, cone(6, 1.4, { damage: 130, status: { type: "stun", dur: 1.0 } }), blast("self", 6, "team", { shield: 150, shieldDur: 3 })),
    ],
  }),

  // ───── MIND — energy, focus, illusions, disruption ─────
  hero({
    id: "zen", name: "זן", title: "נזיר הנשימה", region: "mind", role: "damage", rarity: "common",
    story: "תרגל שקט שנים, עד שגילה שגם שקט יכול להכות.",
    look: { body: "#4a3f6b", trim: "#9b7fd1", glow: "#e0d4ff", weapon: "orb" },
    abilities: [
      ab("basic", "zen-pulse", "דופק", "קליע אנרגיה.", { cd: 0.55, range: 11 }, shot(60)),
      ab("special", "zen-focus", "מיקוד", "פולס שמשתיק אויבים באזור.", { cd: 8, cost: 25, range: 10 }, blast("aim", 3, "enemies", { damage: 70, status: { type: "silence", dur: 1.2 } })),
      ab("defense", "zen-drift", "ריחוף", "הבזק לכיוון הכוונה והגנה קצרה.", { cd: 10, cost: 15 }, dash(5), self({ status: { type: "guard", dur: 1, value: 0.4 } })),
      ab("ultimate", "zen-void", "ריק", "אזור שמאט ופוגע.", { cd: 40, cost: 60, range: 10, cast: 0.5 }, zone("aim", 4.5, 4, "enemies", { damage: 32, status: { type: "slow", dur: 0.8, value: 0.4 } })),
    ],
  }),
  hero({
    id: "monolith", name: "מונולית", title: "הפסל השקט", region: "mind", role: "tank", rarity: "rare",
    story: "אבן שהתעוררה ממדיטציה של אלף שנה. אי אפשר להזיז אותו כשהוא לא רוצה.",
    look: { body: "#3a3550", trim: "#b9a8e8", glow: "#d9c8ff", weapon: "hammer" },
    abilities: [
      ab("basic", "monolith-tap", "הקשה", "מכה כבדה.", { cd: 0.8, range: 2.7 }, cone(2.7, 1.4, { damage: 80 })),
      ab("special", "monolith-pull", "משיכה", "גל שמאט ומסמן אויבים לפניך.", { cd: 8, cost: 25 }, cone(6.5, 0.9, { damage: 70, status: { type: "slow", dur: 2, value: 0.4 } })),
      ab("defense", "monolith-stone", "אבן", "הגנה ומגן.", { cd: 11, cost: 20 }, self({ shield: 180, shieldDur: 3, status: { type: "guard", dur: 2, value: 0.35 } })),
      ab("ultimate", "monolith-stillness", "דממה", "כל האויבים סביבך מושהים.", { cd: 42, cost: 60, cast: 0.6 }, blast("self", 5.5, "enemies", { damage: 150, status: { type: "stun", dur: 1.2 } })),
    ],
  }),
  hero({
    id: "mirage", name: "מיראז׳", title: "אמנית האשליות", region: "mind", role: "support", rarity: "legendary",
    story: "אומרים שאיש לא ראה את פניה האמיתיות. היא מבלבלת את האויב ומטעינה את החברים.",
    look: { body: "#5b4a8f", trim: "#fff6d8", glow: "#ffe9a8", weapon: "fan" },
    abilities: [
      ab("basic", "mirage-shard", "רסיס", "קליע מהיר.", { cd: 0.5, range: 11 }, shot(58)),
      ab("special", "mirage-echo", "הד", "אנרגיה ומגן לבני הצוות.", { cd: 9, cost: 25, cast: 0.3 }, blast("self", 6, "team", { energy: 35, shield: 160, shieldDur: 3, heal: 70 })),
      ab("defense", "mirage-vanish", "היעלמות", "קפיצה לאחור, מהירות והגנה.", { cd: 11, cost: 15 }, dash(6, undefined, true), self({ status: { type: "haste", dur: 1.5, value: 0.4 } })),
      ab("ultimate", "mirage-illusion", "אשליה", "אויבים באזור מושתקים ומואטים; בני הצוות מתרפאים.", { cd: 42, cost: 60, range: 9, cast: 0.5 }, blast("aim", 5, "enemies", { status: { type: "silence", dur: 2.5 } }), blast("aim", 5, "enemies", { status: { type: "slow", dur: 2.5, value: 0.35 } }), blast("aim", 5, "team", { heal: 150 }), blast("self", 3, "self", { heal: 150 })),
    ],
  }),
];

export const HERO_BY_ID: Record<string, HeroDef> = Object.fromEntries(HEROES.map((h) => [h.id, h]));
/** Free for everyone so a new player can play immediately (one of each role). */
export const STARTER_HEROES = ["aegis", "sage", "vita"];
