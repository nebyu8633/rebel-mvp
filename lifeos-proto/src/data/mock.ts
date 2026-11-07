/** Mock LifeOS data for the isolated prototype. Labelled "mock" everywhere it is shown. */
import { domainProgress, type LifeOSReadAdapter, type LifeOSSnapshot } from "./lifeos";

const DAY = 864e5;
const d = (days: number) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10);

export function mockSnapshot(): LifeOSSnapshot {
  const goals: LifeOSSnapshot["goals"] = [
    { id: "g-run", title: "לרוץ 10 ק״מ", region: "health", status: "active", targetDate: d(40), progress: 0.62 },
    { id: "g-sleep", title: "שינה קבועה 7 שעות", region: "health", status: "active", targetDate: d(25), progress: 0.8 },
    { id: "g-save", title: "קרן חירום 10,000 ₪", region: "wealth", status: "active", targetDate: d(120), progress: 0.45 },
    { id: "g-course", title: "קורס פיתוח משחקים", region: "knowledge", status: "active", targetDate: d(18), progress: 0.7 },
    { id: "g-books", title: "12 ספרים השנה", region: "knowledge", status: "active", targetDate: d(200), progress: 0.5 },
    { id: "g-portfolio", title: "תיק עבודות מקצועי", region: "career", status: "active", targetDate: d(10), progress: 0.55 },
    { id: "g-friends", title: "מפגש שבועי עם חברים", region: "social", status: "active", targetDate: d(60), progress: 0.7 },
    { id: "g-meditate", title: "מדיטציה 10 דק׳ ביום", region: "mind", status: "active", targetDate: d(30), progress: 0.3 },
  ];
  return {
    source: "mock",
    profile: { displayName: "שחקן", lifeXp: 2850, level: 12, levelFloorXp: 2400, nextLevelXp: 3300 },
    goals,
    tasks: [
      { id: "t1", title: "אימון 30 דקות", goalId: "g-run", region: "health", date: d(0), status: "planned" },
      { id: "t2", title: "לקרוא 20 עמודים", goalId: "g-books", region: "knowledge", date: d(0), status: "planned" },
      { id: "t3", title: "לעדכן פרויקט בתיק העבודות", goalId: "g-portfolio", region: "career", date: d(0), status: "planned" },
      { id: "t4", title: "להעביר 300 ₪ לחיסכון", goalId: "g-save", region: "wealth", date: d(1), status: "planned" },
    ],
    milestones: [
      { id: "m1", goalId: "g-course", title: "סיום מודול 3", region: "knowledge", done: true, unlocks: "ספריית הכיכר" },
      { id: "m2", goalId: "g-run", title: "5 ק״מ ברצף", region: "health", done: true, unlocks: "מסלול הריצה בפארק" },
      { id: "m3", goalId: "g-portfolio", title: "3 פרויקטים בתיק", region: "career", done: false, unlocks: "מגדל הקריירה — קומה 2" },
      { id: "m4", goalId: "g-meditate", title: "רצף של 14 יום", region: "mind", done: false, unlocks: "גן הזן" },
      { id: "m5", goalId: "g-save", title: "5,000 ₪ בקרן", region: "wealth", done: false, unlocks: "שער רובע העושר" },
    ],
    domainProgress: domainProgress(goals),
    world: {
      points: 340,
      discoveries: ["המזרקה המרכזית", "מגדל LifeOS"],
      unlockedBuildings: ["ספריית הכיכר", "מסלול הריצה בפארק"],
      cityConstruction: 0.18,
      achievements: [
        { id: "a1", title: "צעדים ראשונים בעיר", at: d(-3) },
        { id: "a2", title: "גילית את המזרקה", at: d(-1) },
      ],
    },
  };
}

export class MockLifeOSAdapter implements LifeOSReadAdapter {
  readonly kind = "mock" as const;
  async load() {
    return mockSnapshot();
  }
}
