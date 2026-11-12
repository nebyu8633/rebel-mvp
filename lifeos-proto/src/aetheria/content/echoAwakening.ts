/**
 * Content: "Voices from the Fragment" — the Future Echo's first conversation and its evolution
 * from the Silent Observer into the Fragmented Mind. Pure data; essential (no real-life gating).
 */
import type { Action, Condition, WorldState } from "../core/state";
import type { QuestDef } from "../core/quests";
import type { DialogueDef } from "../core/dialogue";
import { KINGDOM_IDS } from "../core/model";
import { F as F1 } from "./firstResonance";

export const E = {
  approached: "echo.approached",
  firstWords: "echo.first_words",
  bondChosen: "echo.bond_chosen",
} as const;
export const MEM = { bond: "echo.bond", visits: "echo.visits", talks: "echo.talks" } as const;
export type Bond = "form" | "change" | "connection";

/** The Echo stops withdrawing and waits for the player once the six kingdoms are revealed. */
export const echoWaits = (s: WorldState) => s.flags.includes(F1.kingdoms) && s.echo === "silent_observer";

export const ECHO_AWAKENING: QuestDef = {
  id: "echo_awakening",
  title: "קולות מן השבר",
  essential: true,
  available: { flag: F1.kingdoms },
  steps: [
    { id: "approach", text: "גשו אל הד העתיד, שמחכה ליד החותמות", done: { flag: E.approached } },
    { id: "touch", text: "הושיטו יד אל ההד", done: { echoAtLeast: "fragmented_mind" } },
    { id: "listen", text: "הקשיבו למה שנשאר בו", done: { flag: E.firstWords } },
    { id: "answer", text: "ענו לשאלה שלו", done: { flag: E.bondChosen } },
  ],
};

const touch: Action[] = [{ type: "advanceEcho", to: "fragmented_mind" }, { type: "journal", id: "j.fragmented" }];
const bond = (b: Bond): Action[] => [{ type: "remember", key: MEM.bond, value: b }, { type: "setFlag", flag: E.bondChosen }, { type: "journal", id: "j.bond" }];
const isBond = (b: Bond): Condition => ({ memory: MEM.bond, equals: b });

export const FIRST_TOUCH: DialogueDef = {
  id: "echo_first_touch",
  start: "start",
  essential: true,
  nodes: {
    start: {
      speaker: "narrator",
      lines: [{ text: "ההד לא נמוג הפעם. הוא עומד מולך, ומושיט יד של אור." }],
      choices: [
        { id: "touch", text: "לגעת ביד", actions: touch, next: "shatter" },
        { id: "wait", text: "לחכות", next: "waits" },
      ],
    },
    waits: {
      speaker: "narrator",
      lines: [{ text: "הוא ממתין. היד עדיין מושטת, והאור בה רועד." }],
      choices: [{ id: "touch", text: "לגעת ביד", actions: touch, next: "shatter" }],
    },
    shatter: {
      speaker: "narrator",
      lines: [{ text: "האור נסדק לאלף רסיסים. מבין הרסיסים עולה קול, שבור כמו זכוכית." }],
      next: "first_words",
    },
    first_words: {
      speaker: "echo",
      actions: [{ type: "setFlag", flag: E.firstWords }],
      lines: [{ text: "אני… זוכר אותך. לא. אזכור. עוד לא… היינו." }],
      choices: [
        { id: "who", text: "מי אתה?", next: "who" },
        { id: "broken", text: "למה אתה שבור?", next: "broken" },
      ],
    },
    who: {
      speaker: "echo",
      lines: [{ text: "מה שתהיה… אם תמשיך ללכת. הד. רק הד… של צעד שעוד לא עשית." }],
      next: "question",
    },
    broken: {
      speaker: "echo",
      lines: [{ text: "הבריאה נשברה… ואני בתוכה. כל רסיס… זוכר משהו אחר." }],
      next: "question",
    },
    question: {
      speaker: "echo",
      lines: [{ text: "שלושה כוחות… קוראים. אחד מהם… שומע אותך. איזה?" }],
      choices: [
        { id: "form", text: "צורה. לבנות את מה שעוד אין.", actions: bond("form"), next: "farewell" },
        { id: "change", text: "שינוי. להפוך את מה שנשבר.", actions: bond("change"), next: "farewell" },
        { id: "connection", text: "חיבור. לחבר את מה שהתפרק.", actions: bond("connection"), next: "farewell" },
      ],
    },
    farewell: {
      speaker: "echo",
      lines: [
        { text: "צורה… אז נבנה. אבן אחר אבן.", when: isBond("form") },
        { text: "שינוי… טוב. שום דבר כאן… לא נשאר כמו שהיה.", when: isBond("change") },
        { text: "חיבור… כן. גם אני… רסיס שמחכה לחיבור.", when: isBond("connection") },
        { text: "אז… נתחיל." },
      ],
      next: "gate",
    },
    gate: {
      speaker: "echo",
      lines: [{ text: "שם… בקצה הרמה. שער. הוא עוד ישן. כשתלמד… את הכוח… הוא יתעורר." }],
      next: null,
    },
  },
};

/** Shared with the gate content (kept here to avoid an import cycle). */
const GATE_AWAKE = "gate.awake";
const whole: Condition = { echoAtLeast: "future_companion" };
const gateAwaits: Condition = { all: [{ flag: GATE_AWAKE }, { echoIs: "fragmented_mind" }] };

const lifeMemory: Condition = { any: KINGDOM_IDS.map((k) => ({ flag: `life:memory.${k}_shard` })) };

/** Repeatable conversation; reads differently depending on what the Echo remembers. */
export const ECHO_TALK: DialogueDef = {
  id: "echo_talk",
  start: "start",
  // the gate choice is on the main path, so this conversation must stay free of real-life gating
  essential: true,
  nodes: {
    start: {
      speaker: "echo",
      actions: [{ type: "count", key: MEM.talks }],
      lines: [
        // optional real-life flavour (never required): a verified milestone left a memory here
        // the Kingdom of Knowledge: it does not solve the puzzle for you; it only says where to look
        { text: "הקודקס פתוח. חסרים בו חמישה חלקים, וכל אחד מהם הוא ממלכה. אני רוצה לראות את כולן. ואתה?", when: { flag: "knowledge.codex" } },
        { text: "אני לא אגיד לך את הדפוס. אבל כשתעמוד ליד כל חוגה, תסתכל אל העדשה. היא מסתכלת בחזרה.", when: { flag: "knowledge.entered" } },
        { text: "השער… נפתח. אני מרגיש אותו בכל הרסיסים. ספר לי… מה ראית.", when: gateAwaits },
        { text: "שלושת הזיכרונות… החזרת לי אותם. עכשיו אני זוכר איך הכול נשבר. ואולי גם איך מאחים.", when: { all: [{ discovered: "memory_colonnade" }, { discovered: "memory_south_rim" }, { discovered: "memory_star_chart" }] } },
        { text: "אני כאן, שלם. כל צעד שתעשה מכאן, נעשה יחד.", when: whole },
        { text: "ראיתי אור… מהעולם השני. משהו שעשית שם… הגיע עד לכאן.", when: lifeMemory },
        { text: "שוב כאן. אני מתחיל… לזכור את הצעדים שלך.", when: { memory: MEM.visits, atLeast: 3 } },
        { text: "האבנים… זוכרות את הידיים שלך. צורה.", when: isBond("form") },
        { text: "משהו זז מאז שבאת. שינוי… תמיד משאיר עקבות.", when: isBond("change") },
        { text: "אני שומע את החוטים… בין הרסיסים. חיבור.", when: isBond("connection") },
        { text: "אתה חוזר. גם אני… חוזר. ברסיסים." },
      ],
      choices: [
        { id: "gate", text: "השער התעורר. חיברתי את האור.", when: gateAwaits, next: "gate_told" },
        { id: "kingdoms", text: "ספר לי על הממלכות", next: "kingdoms" },
        { id: "next", text: "מה הלאה?", next: "next" },
        { id: "bye", text: "להיפרד", next: null },
      ],
    },
    gate_told: {
      speaker: "echo",
      lines: [{ text: "צורה… שינוי… חיבור. השתמשת בשלושתם. אני שומע אותם… מתאחים." }],
      next: "becoming",
    },
    becoming: {
      speaker: "narrator",
      actions: [{ type: "advanceEcho", to: "future_companion" }, { type: "journal", id: "j.companion" }],
      lines: [{ text: "הרסיסים נמשכים זה אל זה. האור מתייצב, חם וזהוב, והקול כבר לא נשבר." }],
      next: "companion",
    },
    companion: {
      speaker: "echo",
      lines: [{ text: "עכשיו אני זוכר בבירור. אני מה שתהיה, ואני כבר לא מחכה בצד. נלך יחד אל הממלכות." }],
      next: "menu",
    },
    menu: {
      speaker: "echo",
      lines: [{ text: "עוד…?" }],
      choices: [
        { id: "kingdoms", text: "ספר לי על הממלכות", next: "kingdoms" },
        { id: "next", text: "מה הלאה?", next: "next" },
        { id: "bye", text: "להיפרד", next: null },
      ],
    },
    kingdoms: {
      speaker: "echo",
      lines: [{ text: "שש… ממלכות. הן לא נעלמו. הן… מחכות שמישהו יזכור אותן." }],
      next: "menu",
    },
    next: {
      speaker: "echo",
      lines: [
        { text: "מעבר לשער… גשר. בקצה שלו, הממלכה הראשונה מחכה. כשתהיה מוכן, נלך.", when: whole },
        { text: "השער ער. לך… אליו, ואז חזור אליי.", when: { flag: GATE_AWAKE } },
        { text: "הטבעות… לימדו אותך. עכשיו לך אל השער, במערב. צורה, אחר כך שינוי, אחר כך חיבור.", when: { power: "connection" } },
        { text: "השער… צריך כוח שעוד לא למדת. לך אל טבעות האסטרולב. הן ילמדו אותך." },
      ],
      next: "menu",
    },
  },
};

/** Which conversation the Echo offers right now (null = none). */
export function echoDialogueFor(s: WorldState): DialogueDef | null {
  if (!s.flags.includes(F1.kingdoms)) return null;
  if (!s.flags.includes(E.bondChosen)) return s.flags.includes(E.approached) ? FIRST_TOUCH : null;
  return s.echo !== "dormant" && s.echo !== "silent_observer" ? ECHO_TALK : null;
}

export const ECHO_JOURNAL = {
  "j.fragmented": {
    title: "התודעה המפוצלת",
    body: "נגעתי ביד של ההד, והוא נשבר לרסיסים. עכשיו הוא מדבר, במשפטים חצויים, כמו זיכרון שמנסה להיזכר בעצמו.",
  },
  "j.bond": {
    title: "הקשר",
    body: "ההד שאל איזה מהכוחות שומע אותי. עניתי, והוא זכר. משהו בינינו התחיל להתחבר.",
  },
};
