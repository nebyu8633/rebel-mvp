import { COLLECTIONS, emptyDB, type CollectionName, type DB, type EntityOf } from "../types";

export interface Repository {
  readonly mode: "local" | "supabase";
  load(): Promise<{ db: DB; quarantined: number }>;
  put<C extends CollectionName>(collection: C, entity: EntityOf<C>): Promise<void>;
  remove(collection: CollectionName, id: string): Promise<void>;
  /** Subscribe to changes made elsewhere (other tab). Returns unsubscribe. */
  onExternalChange?(cb: () => void): () => void;
}

/** Table name in Postgres for each collection. */
export const TABLES: Record<CollectionName, string> = {
  goals: "goals",
  milestones: "milestones",
  objectives: "objectives",
  tasks: "tasks",
  occurrences: "task_occurrences",
  events: "calendar_events",
  habits: "habits",
  habitLogs: "habit_logs",
  meals: "meals",
  mealPlan: "meal_plan_entries",
  mealWeeks: "meal_weeks",
  groceries: "grocery_items",
  pantry: "pantry_items",
  financeAccounts: "finance_accounts",
  financeEntries: "finance_entries",
  weightLogs: "weight_logs",
  settings: "user_settings",
};

/** Parent-first order, used when loading and when bulk-writing to satisfy foreign keys. */
export const COLLECTION_ORDER: CollectionName[] = [
  "settings",
  "goals",
  "financeAccounts",
  "milestones",
  "objectives",
  "tasks",
  "occurrences",
  "events",
  "habits",
  "habitLogs",
  "meals",
  "mealWeeks",
  "mealPlan",
  "groceries",
  "pantry",
  "financeEntries",
  "weightLogs",
];

export const camelToSnake = (s: string) => s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
export const snakeToCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export function fieldsOf(c: CollectionName): string[] {
  return Object.keys(COLLECTIONS[c].shape);
}

/**
 * Validate raw records into a DB. Invalid records are returned separately so the caller
 * can keep them (quarantine) instead of silently discarding user data.
 */
export function hydrate(raw: Partial<Record<CollectionName, Record<string, unknown>>>): {
  db: DB;
  invalid: Array<{ collection: CollectionName; id: string; record: unknown; error: string }>;
} {
  const db = emptyDB();
  const invalid: Array<{ collection: CollectionName; id: string; record: unknown; error: string }> = [];
  for (const c of COLLECTION_ORDER) {
    const recs = raw[c] ?? {};
    for (const [id, rec] of Object.entries(recs)) {
      const r = COLLECTIONS[c].safeParse(rec);
      if (r.success) (db[c] as Record<string, unknown>)[id] = r.data;
      else invalid.push({ collection: c, id, record: rec, error: r.error.issues[0]?.message ?? "invalid" });
    }
  }
  return { db, invalid };
}
