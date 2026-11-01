import type { SupabaseClient } from "@supabase/supabase-js";
import type { CollectionName, EntityOf } from "../types";
import { camelToSnake, COLLECTION_ORDER, fieldsOf, hydrate, snakeToCamel, TABLES, type BatchOp, type Repository } from "./repo";

/** Rows ↔ entities: camelCase fields map 1:1 to snake_case columns; user_id is added server-side by default + RLS. */
export function toRow(collection: CollectionName, entity: Record<string, unknown>, userId: string) {
  const row: Record<string, unknown> = { user_id: userId };
  for (const f of fieldsOf(collection)) row[camelToSnake(f)] = entity[f] ?? null;
  return row;
}

export function fromRow(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "user_id") continue;
    out[snakeToCamel(k)] = v;
  }
  return out;
}

function friendly(error: { message?: string; code?: string } | null): Error {
  if (!error) return new Error("שגיאה לא ידועה");
  if (error.code === "42501") return new Error("אין הרשאה לשמור את הנתונים (RLS)");
  if (error.code === "23503") return new Error("הרשומה מפנה לפריט שלא קיים");
  if (error.message?.includes("JWT")) return new Error("פג תוקף ההתחברות — יש להתחבר מחדש");
  return new Error(`שגיאת מסד נתונים: ${error.message ?? error.code}`);
}

export class SupabaseRepository implements Repository {
  readonly mode = "supabase" as const;
  constructor(
    private sb: SupabaseClient,
    private userId: string,
  ) {}

  async load() {
    const raw: Partial<Record<CollectionName, Record<string, unknown>>> = {};
    await Promise.all(
      COLLECTION_ORDER.map(async (c) => {
        const all: Record<string, unknown> = {};
        const PAGE = 1000;
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await this.sb.from(TABLES[c]).select("*").range(from, from + PAGE - 1);
          if (error) throw friendly(error);
          for (const row of data ?? []) {
            const e = fromRow(row);
            all[e.id as string] = e;
          }
          if (!data || data.length < PAGE) break;
        }
        raw[c] = all;
      }),
    );
    const { db, invalid } = hydrate(raw);
    if (invalid.length) console.warn("LifeOS: records failed validation and were not loaded", invalid);
    return { db, quarantined: invalid.length };
  }

  async put<C extends CollectionName>(collection: C, entity: EntityOf<C>) {
    const { error } = await this.sb
      .from(TABLES[collection])
      .upsert(toRow(collection, entity as Record<string, unknown>, this.userId), { onConflict: "user_id,id" });
    if (error) throw friendly(error);
  }

  /** One Postgres transaction via the apply_batch RPC (see migrations); RLS still applies. */
  async applyBatch(ops: BatchOp[]) {
    const payload = ops.map((o) =>
      o.op === "put"
        ? { op: "upsert", table: TABLES[o.collection], row: toRow(o.collection, o.entity, this.userId) }
        : { op: "delete", table: TABLES[o.collection], id: o.id },
    );
    const { error } = await this.sb.rpc("apply_batch", { ops: payload });
    if (error) throw friendly(error);
  }

  async remove(collection: CollectionName, id: string) {
    const { error } = await this.sb.from(TABLES[collection]).delete().eq("id", id);
    if (error) throw friendly(error);
  }
}
