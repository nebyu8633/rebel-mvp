import type { CollectionName, DB, EntityOf } from "../types";
import { hydrate, type BatchOp, type Repository } from "./repo";

const KEY = "lifeos:db:v1";
const QUARANTINE_KEY = "lifeos:quarantine:v1";

/**
 * Local mode: the whole database lives in this browser's localStorage.
 * Single user, no sign-in. Data survives refreshes but not clearing site data,
 * and is not synced between devices.
 */
export class LocalRepository implements Repository {
  readonly mode = "local" as const;
  private raw: Record<string, Record<string, unknown>> = {};

  async load() {
    let parsed: Record<string, Record<string, unknown>> = {};
    const text = localStorage.getItem(KEY);
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        // Keep the unreadable payload instead of overwriting it.
        localStorage.setItem(`${KEY}:corrupt:${Date.now()}`, text);
        parsed = {};
      }
    }
    const { db, invalid } = hydrate(parsed);
    if (invalid.length) {
      const prev = JSON.parse(localStorage.getItem(QUARANTINE_KEY) || "[]");
      localStorage.setItem(QUARANTINE_KEY, JSON.stringify([...prev, ...invalid]));
    }
    this.raw = db as unknown as Record<string, Record<string, unknown>>;
    return { db, quarantined: invalid.length };
  }

  private persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.raw));
    } catch (e) {
      throw new Error(e instanceof DOMException && e.name === "QuotaExceededError" ? "אחסון הדפדפן מלא" : "שמירה מקומית נכשלה");
    }
  }

  async put<C extends CollectionName>(collection: C, entity: EntityOf<C>) {
    this.raw[collection] = { ...(this.raw[collection] ?? {}), [(entity as { id: string }).id]: entity };
    this.persist();
  }

  async remove(collection: CollectionName, id: string) {
    const next = { ...(this.raw[collection] ?? {}) };
    delete next[id];
    this.raw[collection] = next;
    this.persist();
  }

  async applyBatch(ops: BatchOp[]) {
    const prev = this.raw;
    const next: Record<string, Record<string, unknown>> = { ...prev };
    for (const o of ops) {
      const col = { ...(next[o.collection] ?? {}) };
      if (o.op === "put") col[o.entity.id] = o.entity;
      else delete col[o.id];
      next[o.collection] = col;
    }
    this.raw = next;
    try {
      this.persist(); // single write → all-or-nothing
    } catch (e) {
      this.raw = prev;
      throw e;
    }
  }

  onExternalChange(cb: () => void) {
    const h = (e: StorageEvent) => {
      if (e.key === KEY) cb();
    };
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
  }

  /** Full export for backups. */
  static exportJSON(db: DB): string {
    return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), db }, null, 2);
  }
}
