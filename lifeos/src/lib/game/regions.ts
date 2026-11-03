import type { Goal, GoalKind, RegionId, XpEvent } from "../types";

export type Attribute = XpEvent["attribute"];

export interface RegionDef {
  id: RegionId;
  name: string;
  short: string;
  attribute: Attribute;
  /** Palette for the 3D island. */
  color: { ground: string; accent: string; roof: string; glow: string };
  /** Position on the world ring (angle in radians). */
  angle: number;
  /** One building/landmark per development stage (1..5). */
  stages: Array<{ title: string; building: string }>;
}

export const REGIONS: RegionDef[] = [
  {
    id: "wealth",
    name: "אי העושר",
    short: "עושר",
    attribute: "wealth",
    color: { ground: "#6f8f5a", accent: "#d4a73c", roof: "#b8862b", glow: "#f6d77a" },
    angle: 0,
    stages: [
      { title: "יישוב קטן", building: "בית המטבע" },
      { title: "מרכז פיננסי", building: "הבנק המרכזי" },
      { title: "רובע השקעות", building: "מגדל ההשקעות" },
      { title: "רובע מפותח", building: "האוצר" },
      { title: "מטרופולין פיננסית", building: "מגדל הזהב" },
    ],
  },
  {
    id: "health",
    name: "אי הבריאות",
    short: "בריאות",
    attribute: "strength",
    color: { ground: "#4f8a55", accent: "#e46b4f", roof: "#a9473a", glow: "#ffb199" },
    angle: (Math.PI * 2) / 6,
    stages: [
      { title: "שדה אימונים", building: "שדה האימונים" },
      { title: "חדר כושר", building: "חדר הכושר" },
      { title: "מתחם ספורט", building: "מתחם הספורט" },
      { title: "מרכז התאוששות", building: "מעיינות ההתאוששות" },
      { title: "מקדש ההרים", building: "מקדש האימונים בהר" },
    ],
  },
  {
    id: "knowledge",
    name: "אי הידע",
    short: "ידע",
    attribute: "intelligence",
    color: { ground: "#5d7f93", accent: "#4f7ad9", roof: "#2f4f9e", glow: "#a9c4ff" },
    angle: ((Math.PI * 2) / 6) * 2,
    stages: [
      { title: "ספרייה קטנה", building: "הספרייה הקטנה" },
      { title: "אקדמיה", building: "האקדמיה" },
      { title: "אוניברסיטה", building: "האוניברסיטה" },
      { title: "מצפה כוכבים", building: "מצפה הכוכבים" },
      { title: "מרכז הידע הגדול", building: "הספרייה הגדולה" },
    ],
  },
  {
    id: "career",
    name: "עיר הקריירה",
    short: "קריירה",
    attribute: "career",
    color: { ground: "#7b7f86", accent: "#53b3c9", roof: "#2e6f86", glow: "#9ee6f7" },
    angle: ((Math.PI * 2) / 6) * 3,
    stages: [
      { title: "משרד ראשון", building: "המשרד הראשון" },
      { title: "רחוב עסקים", building: "מרכז היזמות" },
      { title: "רובע חדשנות", building: "מרכז החדשנות" },
      { title: "מטה", building: "המטה" },
      { title: "קו רקיע", building: "מגדל הקריירה" },
    ],
  },
  {
    id: "social",
    name: "כפר החברים",
    short: "חברתי",
    attribute: "social",
    color: { ground: "#7fa05c", accent: "#e59a4a", roof: "#c0582f", glow: "#ffd09a" },
    angle: ((Math.PI * 2) / 6) * 4,
    stages: [
      { title: "בית ראשון", building: "הבית" },
      { title: "גינה קהילתית", building: "הגינה" },
      { title: "כיכר הכפר", building: "כיכר המפגשים" },
      { title: "בית הקהילה", building: "בית הקהילה" },
      { title: "כפר משגשג", building: "אולם החגיגות" },
    ],
  },
  {
    id: "mind",
    name: "מקדש התודעה",
    short: "תודעה",
    attribute: "discipline",
    color: { ground: "#6e8a74", accent: "#9b7fd1", roof: "#5b4a8f", glow: "#d9c8ff" },
    angle: ((Math.PI * 2) / 6) * 5,
    stages: [
      { title: "גן שקט", building: "הגן השקט" },
      { title: "מקום מדיטציה", building: "אבני המדיטציה" },
      { title: "שער המקדש", building: "שער המקדש" },
      { title: "המקדש", building: "המקדש" },
      { title: "פסגת התודעה", building: "מגדל האור" },
    ],
  },
];

export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<RegionId, RegionDef>;

const KIND_REGION: Record<GoalKind, RegionId> = {
  weight: "health",
  portfolio: "wealth",
  motorcycle: "wealth",
  purchase: "wealth",
  income: "career",
  learning: "knowledge",
  custom: "mind",
};

export function regionOfGoal(goal: Pick<Goal, "region" | "kind">): RegionId {
  return goal.region ?? KIND_REGION[goal.kind];
}

export const ATTRIBUTES: Array<{ id: Attribute; name: string; hint: string }> = [
  { id: "strength", name: "כוח", hint: "בריאות וכושר" },
  { id: "intelligence", name: "תבונה", hint: "למידה" },
  { id: "wealth", name: "עושר", hint: "מטרות כספיות" },
  { id: "discipline", name: "משמעת", hint: "עקביות והתחייבויות" },
  { id: "career", name: "קריירה", hint: "מקצוע ועסקים" },
  { id: "social", name: "חברתי", hint: "קשרים" },
];

/**
 * Region XP needed for each landmark. 0 landmarks = undeveloped land; each threshold reached
 * builds the next landmark (stages 1..5).
 */
export const STAGE_THRESHOLDS = [20, 100, 300, 600, 1000];
export const UNDEVELOPED = "אדמה לא מפותחת";
