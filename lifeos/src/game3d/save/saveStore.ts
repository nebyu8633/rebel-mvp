/**
 * AETHERIA save system. Versioned + validated (zod); local only in this phase (no backend, no DB).
 * A server-backed store can implement the same SaveStore interface later (needs separate approval).
 * Corrupted or unknown-version saves are never silently overwritten: they're kept under a backup key.
 */
import { z } from "zod";
import { ECHO_STAGES } from "../aetheria/core/model";
import { initialWorldState, type WorldState } from "../aetheria/core/state";
import { defaultLoadout, SLOTS, type Loadout } from "../avatar/loadout";
import type { EnrichmentLedger } from "../aetheria/core/enrichment";

const WorldStateSchema = z.object({
  flags: z.array(z.string().max(64)).max(2000),
  discoveries: z.array(z.string().max(64)).max(2000),
  journal: z.array(z.object({ id: z.string().max(64), at: z.string() })).max(2000),
  echo: z.enum(ECHO_STAGES),
  history: z.array(z.object({ at: z.string(), action: z.string(), detail: z.string().max(200) })).max(500),
});
const LoadoutSchema = z.object({
  base: z.enum(["auto", "placeholder", "personal"]),
  equipped: z.partialRecord(z.enum(SLOTS), z.string().max(64)),
  tier: z.number().int().min(0).max(3),
});
export const SaveV1 = z.object({
  version: z.literal(1),
  savedAt: z.string(),
  world: WorldStateSchema,
  loadout: LoadoutSchema,
  enrichment: z.object({ applied: z.record(z.string(), z.string().nullable()) }),
});
export type SaveData = z.infer<typeof SaveV1>;

export const newSave = (): SaveData => ({ version: 1, savedAt: new Date(0).toISOString(), world: initialWorldState(), loadout: defaultLoadout(), enrichment: { applied: {} } });

export type ParseResult = { ok: true; data: SaveData } | { ok: false; reason: string };

/** Parse + migrate. Only v1 exists; future versions add migration steps here. */
export function parseSave(raw: unknown): ParseResult {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "not an object" };
  const v = (raw as { version?: unknown }).version;
  if (v !== 1) return { ok: false, reason: `unsupported save version ${String(v)}` };
  const r = SaveV1.safeParse(raw);
  return r.success ? { ok: true, data: r.data } : { ok: false, reason: r.error.issues[0]?.message ?? "invalid save" };
}

export interface SaveStore {
  load(): Promise<SaveData | null>;
  save(data: { world: WorldState; loadout: Loadout; enrichment: EnrichmentLedger }): Promise<SaveData>;
  clear(): Promise<void>;
}

export interface KeyValue {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export class LocalSaveStore implements SaveStore {
  constructor(
    private readonly kv: KeyValue,
    private readonly key = "aetheria:save:slot1",
  ) {}
  async load() {
    let text: string | null = null;
    try {
      text = this.kv.getItem(this.key);
    } catch {
      return null;
    }
    if (!text) return null;
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      raw = null;
    }
    const r = parseSave(raw);
    if (r.ok) return r.data;
    // keep the unreadable save instead of losing it
    try {
      this.kv.setItem(`${this.key}:backup:${Date.now()}`, text);
      this.kv.removeItem(this.key);
    } catch {
      /* storage unavailable */
    }
    return null;
  }
  async save(d: { world: WorldState; loadout: Loadout; enrichment: EnrichmentLedger }) {
    const data: SaveData = SaveV1.parse({ version: 1, savedAt: new Date().toISOString(), world: d.world, loadout: d.loadout, enrichment: d.enrichment });
    try {
      this.kv.setItem(this.key, JSON.stringify(data));
    } catch {
      /* private mode / quota: the session continues in memory */
    }
    return data;
  }
  async clear() {
    try {
      this.kv.removeItem(this.key);
    } catch {
      /* ignore */
    }
  }
}

export class MemoryKV implements KeyValue {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}
