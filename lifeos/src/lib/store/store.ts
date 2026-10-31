"use client";
import { create } from "zustand";
import { COLLECTIONS, emptyDB, type CollectionName, type DB, type EntityOf, type Settings } from "../types";
import type { Repository } from "./repo";

export interface Toast {
  id: number;
  kind: "info" | "success" | "error";
  message: string;
  action?: { label: string; run: () => void };
}

interface StoreState {
  db: DB;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  mode: "local" | "supabase" | null;
  quarantined: number;
  saving: number;
  toasts: Toast[];
  repo: Repository | null;
  init(repo: Repository, seed: (db: DB) => Array<[CollectionName, unknown]>): Promise<void>;
  reload(): Promise<void>;
  put<C extends CollectionName>(c: C, entity: EntityOf<C>): Promise<boolean>;
  putMany(items: Array<[CollectionName, unknown]>): Promise<boolean>;
  remove(c: CollectionName, id: string): Promise<boolean>;
  removeMany(items: Array<[CollectionName, string]>): Promise<boolean>;
  toast(message: string, kind?: Toast["kind"], action?: Toast["action"]): void;
  dismiss(id: number): void;
}

let toastSeq = 0;
/** Writes are serialized so parent rows always reach the database before their children. */
let queue: Promise<unknown> = Promise.resolve();

function setEntity(db: DB, c: CollectionName, id: string, entity: unknown | undefined): DB {
  const col = { ...(db[c] as Record<string, unknown>) };
  if (entity === undefined) delete col[id];
  else col[id] = entity;
  return { ...db, [c]: col } as DB;
}

export const useStore = create<StoreState>((set, get) => ({
  db: emptyDB(),
  status: "idle",
  error: null,
  mode: null,
  quarantined: 0,
  saving: 0,
  toasts: [],
  repo: null,

  async init(repo, seed) {
    set({ status: "loading", repo, mode: repo.mode, error: null });
    try {
      const { db, quarantined } = await repo.load();
      set({ db, quarantined, status: "ready" });
      if (quarantined) get().toast(`${quarantined} רשומות לא עברו בדיקת תקינות ונשמרו בצד (לא נמחקו).`, "error");
      const initial = seed(db);
      if (initial.length) await get().putMany(initial);
      repo.onExternalChange?.(() => void get().reload());
    } catch (e) {
      set({ status: "error", error: e instanceof Error ? e.message : "טעינת הנתונים נכשלה" });
    }
  },

  async reload() {
    const repo = get().repo;
    if (!repo) return;
    const { db } = await repo.load();
    set({ db });
  },

  async put(c, entity) {
    return get().putMany([[c, entity]]);
  },

  async putMany(items) {
    const repo = get().repo;
    if (!repo) return false;
    const validated: Array<[CollectionName, { id: string }]> = [];
    for (const [c, e] of items) {
      const r = COLLECTIONS[c].safeParse(e);
      if (!r.success) {
        get().toast(`לא נשמר: ${r.error.issues[0]?.message ?? "נתונים לא תקינים"}`, "error");
        return false;
      }
      validated.push([c, r.data as { id: string }]);
    }
    const before = get().db;
    let next = before;
    for (const [c, e] of validated) next = setEntity(next, c, e.id, e);
    set({ db: next, saving: get().saving + 1 });
    const job = queue.then(async () => {
      for (const [c, e] of validated) await repo.put(c, e as never);
    });
    queue = job.catch(() => undefined);
    try {
      await job;
      return true;
    } catch (err) {
      // Roll back only the entities from this write, keep anything changed since.
      let db = get().db;
      for (const [c, e] of validated) db = setEntity(db, c, e.id, (before[c] as Record<string, unknown>)[e.id]);
      set({ db });
      get().toast(`השינוי לא נשמר: ${err instanceof Error ? err.message : "שגיאה"}`, "error");
      return false;
    } finally {
      set({ saving: get().saving - 1 });
    }
  },

  async remove(c, id) {
    return get().removeMany([[c, id]]);
  },

  async removeMany(items) {
    const repo = get().repo;
    if (!repo) return false;
    const before = get().db;
    let next = before;
    for (const [c, id] of items) next = setEntity(next, c, id, undefined);
    set({ db: next, saving: get().saving + 1 });
    // children first when deleting
    const job = queue.then(async () => {
      for (const [c, id] of items.slice().reverse()) await repo.remove(c, id);
    });
    queue = job.catch(() => undefined);
    try {
      await job;
      return true;
    } catch (err) {
      let db = get().db;
      for (const [c, id] of items) db = setEntity(db, c, id, (before[c] as Record<string, unknown>)[id]);
      set({ db });
      get().toast(`המחיקה נכשלה: ${err instanceof Error ? err.message : "שגיאה"}`, "error");
      return false;
    } finally {
      set({ saving: get().saving - 1 });
    }
  },

  toast(message, kind = "info", action) {
    const id = ++toastSeq;
    set({ toasts: [...get().toasts, { id, kind, message, action }] });
    setTimeout(() => get().dismiss(id), kind === "error" ? 8000 : action ? 6000 : 3500);
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const SETTINGS_ID = "settings";

export function useSettings(): Settings | null {
  return useStore((s) => s.db.settings[SETTINGS_ID] ?? null);
}

export function useDB(): DB {
  return useStore((s) => s.db);
}
