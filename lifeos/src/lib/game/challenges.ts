/**
 * Challenges generated from the player's REAL plan. Targets are sized to what is actually
 * scheduled (never "complete 3 tasks" on a day with one task), so challenges don't create
 * unrealistic workloads. Progress is computed live from completed + verified work.
 */
import type { DB } from "../types";
import { addDays, startOfWeek } from "../dates";
import { instancesInRange, overdueInstances } from "../tasks";
import { isVerified, seasonOf, taskRegion, profileOf } from "./engine";
import { REGION_BY_ID, regionOfGoal } from "./regions";

export interface Challenge {
  id: string;
  period: "daily" | "weekly" | "special" | "season" | "personal";
  title: string;
  target: number;
  progress: number;
  xp: number;
  done: boolean;
  /** Short why (shown on request). */
  why: string;
}

const verifiedDone = (db: DB, i: ReturnType<typeof instancesInRange>[number]) => i.status === "completed" && isVerified(db, i.task, i.key);

export function challengesFor(db: DB, today: string): Challenge[] {
  const out: Challenge[] = [];
  const todayList = instancesInRange(db, today, today, today);

  // DAILY
  const important = todayList.filter((i) => i.task.priority !== "low");
  if (important.length) {
    const target = Math.min(3, important.length);
    const progress = important.filter((i) => verifiedDone(db, i)).length;
    out.push({ id: `d:${today}:important`, period: "daily", title: target === 1 ? "להשלים את המשימה החשובה של היום" : `להשלים ${target} משימות חשובות היום`, target, progress: Math.min(progress, target), xp: 20, done: progress >= target, why: "מבוסס על המשימות שמתוכננות להיום" });
  }
  const regionsToday = new Set(todayList.map((i) => taskRegion(db, i.task)).filter(Boolean));
  if (regionsToday.size >= 2) {
    const progressed = new Set(todayList.filter((i) => verifiedDone(db, i)).map((i) => taskRegion(db, i.task)).filter(Boolean));
    out.push({ id: `d:${today}:two-regions`, period: "daily", title: "להתקדם בשני אזורים היום", target: 2, progress: Math.min(2, progressed.size), xp: 15, done: progressed.size >= 2, why: "יש היום משימות בכמה אזורים" });
  }

  // WEEKLY
  const ws = startOfWeek(today);
  const weekList = instancesInRange(db, ws, addDays(ws, 6), today);
  const msDoneThisWeek = Object.values(db.milestones).filter((m) => m.status === "done" && m.updatedAt.slice(0, 10) >= ws && m.updatedAt.slice(0, 10) <= addDays(ws, 6)).length;
  const reachable = Object.values(db.milestones).some((m) => m.status !== "done" && Object.values(db.tasks).some((t) => t.milestoneId === m.id && t.status !== "completed" && t.date && t.date <= addDays(ws, 6)));
  if (reachable || msDoneThisWeek) out.push({ id: `w:${ws}:milestone`, period: "weekly", title: "להשלים אבן דרך השבוע", target: 1, progress: Math.min(1, msDoneThisWeek), xp: 50, done: msDoneThisWeek >= 1, why: "יש אבן דרך שהמשימות שלה מתוכננות השבוע" });
  const weekRegions = new Set(weekList.map((i) => taskRegion(db, i.task)).filter(Boolean));
  if (weekRegions.size >= 3) {
    const progressed = new Set(weekList.filter((i) => verifiedDone(db, i)).map((i) => taskRegion(db, i.task)).filter(Boolean));
    out.push({ id: `w:${ws}:three-regions`, period: "weekly", title: "התקדמות בשלושה אזורים", target: 3, progress: Math.min(3, progressed.size), xp: 40, done: progressed.size >= 3, why: "השבוע מתוכננות משימות בשלושה אזורים או יותר" });
  }
  const postponed = Object.values(db.tasks).filter((t) => !t.recurrence && t.history.some((h) => h.action === "rescheduled"));
  const postponedDone = postponed.filter((t) => t.status === "completed" && (t.completedAt ?? "").slice(0, 10) >= ws && isVerified(db, t, t.id));
  if (postponed.some((t) => t.status !== "completed") || postponedDone.length)
    out.push({ id: `w:${ws}:postponed`, period: "weekly", title: "לסיים משימה שנדחתה", target: 1, progress: Math.min(1, postponedDone.length), xp: 30, done: postponedDone.length >= 1, why: "יש משימה שהוזזה בעבר" });

  // SPECIAL
  const photoTasks = Object.values(db.tasks).filter((t) => t.evidence === "photo");
  if (photoTasks.length) {
    const proven = photoTasks.filter((t) => t.status === "completed" && isVerified(db, t, t.id) && (t.completedAt ?? "").slice(0, 10) >= ws).length;
    out.push({ id: `s:${ws}:proof`, period: "special", title: "להשלים משימה עם הוכחה מצולמת", target: 1, progress: Math.min(1, proven), xp: 25, done: proven >= 1, why: "יש משימות שמבקשות תמונה" });
  }

  // SEASON
  const season = seasonOf(profileOf(db), today);
  const msInSeason = Object.values(db.milestones).filter((m) => m.targetDate && m.targetDate >= season.start && m.targetDate <= season.end);
  if (msInSeason.length) {
    const target = Math.min(3, msInSeason.length);
    const done = Object.values(db.milestones).filter((m) => m.status === "done" && m.updatedAt.slice(0, 10) >= season.start && m.updatedAt.slice(0, 10) <= season.end).length;
    out.push({ id: `S:${season.start}:milestones`, period: "season", title: `${season.theme}: ${target} אבני דרך`, target, progress: Math.min(target, done), xp: 150, done: done >= target, why: `${msInSeason.length} אבני דרך מתוכננות בעונה הזו` });
  }

  // PERSONAL — the neglected region with an active goal
  const recent = Object.values(db.xpEvents ?? {}).filter((e) => e.at.slice(0, 10) >= addDays(today, -14));
  const activeRegions = [...new Set(Object.values(db.goals).filter((g) => g.status === "active" || g.status === "planning").map((g) => regionOfGoal(g)))];
  const neglected = activeRegions.find((r) => !recent.some((e) => e.region === r));
  if (neglected) {
    const progressed = weekList.some((i) => verifiedDone(db, i) && taskRegion(db, i.task) === neglected);
    out.push({ id: `p:${ws}:${neglected}`, period: "personal", title: `צעד אחד ב${REGION_BY_ID[neglected].name}`, target: 1, progress: progressed ? 1 : 0, xp: 30, done: progressed, why: "לא הייתה התקדמות באזור הזה בשבועיים האחרונים" });
  }
  // a gentle return challenge when there is overdue work (never a punishment):
  // done by finishing (and verifying) one task from an earlier day, today
  const overdue = overdueInstances(db, today);
  const caughtUp = instancesInRange(db, addDays(today, -14), addDays(today, -1), today).filter((i) => {
    if (!verifiedDone(db, i)) return false;
    const at = i.occurrence?.completedAt ?? (i.recurring ? null : i.task.completedAt);
    return !!at && at.slice(0, 10) === today;
  }).length;
  if (overdue.length >= 2 || caughtUp > 0) {
    out.push({ id: `p:${today}:return`, period: "personal", title: "לחזור למסלול: משימה אחת מהאיחור", target: 1, progress: Math.min(1, caughtUp), xp: 15, done: caughtUp >= 1, why: overdue.length ? `${overdue.length} משימות מחכות` : "השלמת משימה מיום קודם" });
  }
  return out;
}
