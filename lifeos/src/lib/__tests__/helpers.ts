import { emptyDB, type DB, type Task, type RecurrenceRule } from "../types";

export const T0 = "2026-01-01T00:00:00.000Z";

export function task(p: Partial<Task> & { id: string }): Task {
  return {
    title: p.id,
    notes: "",
    goalId: null,
    milestoneId: null,
    objectiveId: null,
    priority: "medium",
    estimatedMinutes: null,
    date: null,
    startTime: null,
    deadline: null,
    status: "planned",
    recurrence: null,
    reminderMinutes: null,
    rationale: "",
    dependsOn: [],
    routine: null,
    source: "user",
    completedAt: null,
    history: [],
    createdAt: T0,
    updatedAt: T0,
    ...p,
  };
}

export function rule(p: Partial<RecurrenceRule>): RecurrenceRule {
  return {
    freq: "weekly",
    interval: 1,
    startDate: "2026-11-01",
    endDate: null,
    count: null,
    paused: false,
    exceptions: [],
    missedPolicy: "carry",
    backupWeekday: null,
    ...p,
  };
}

export function dbWith(tasks: Task[]): DB {
  const db = emptyDB();
  for (const t of tasks) db.tasks[t.id] = t;
  return db;
}
