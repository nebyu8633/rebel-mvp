/**
 * AETHERIA world state + the rules engine that changes it.
 *
 * Every change goes through `apply(state, action)`. The engine validates the action (AI or content
 * may PROPOSE actions; only valid ones change the world) and appends an immutable history entry,
 * so consequences are preserved. State is plain JSON (serialisable by the save system).
 */
import { ECHO_STAGES, isLifeFlag, type EchoStage } from "./model";

export interface JournalEntry {
  id: string;
  at: string;
}
export interface HistoryEntry {
  at: string;
  action: Action["type"];
  detail: string;
}

export interface WorldState {
  flags: string[];
  discoveries: string[];
  journal: JournalEntry[];
  echo: EchoStage;
  history: HistoryEntry[];
  /**
   * Narrative memory (small typed values the world and the Future Echo remember: the bond the
   * player chose, how often they returned...). Keys are namespaced; `life.` is reserved.
   */
  memory: Record<string, MemoryValue>;
}
export type MemoryValue = string | number | boolean;

export const initialWorldState = (): WorldState => ({ flags: [], discoveries: [], journal: [], echo: "dormant", history: [], memory: {} });

const MEMORY_KEY = /^(echo|world|player)\.[a-z0-9_.]{1,48}$/;
const MAX_MEMORY_KEYS = 200;

export type Action =
  | { type: "setFlag"; flag: string; source?: "story" | "life" }
  | { type: "clearFlag"; flag: string; source: "life" }
  | { type: "discover"; id: string }
  | { type: "journal"; id: string }
  | { type: "advanceEcho"; to: EchoStage }
  | { type: "remember"; key: string; value: MemoryValue }
  | { type: "count"; key: string; by?: number };

export type ApplyResult = { ok: true; state: WorldState; changed: boolean } | { ok: false; reason: string; state: WorldState };

const MAX_HISTORY = 500;

export function apply(state: WorldState, action: Action, now = new Date().toISOString()): ApplyResult {
  const reject = (reason: string): ApplyResult => ({ ok: false, reason, state });
  const done = (next: Partial<WorldState>, detail: string): ApplyResult => ({
    ok: true,
    changed: true,
    state: { ...state, ...next, history: [...state.history, { at: now, action: action.type, detail }].slice(-MAX_HISTORY) },
  });
  const same = (): ApplyResult => ({ ok: true, changed: false, state });

  switch (action.type) {
    case "setFlag": {
      if (!/^[a-z0-9_:.-]{1,64}$/.test(action.flag)) return reject("invalid flag name");
      // only the enrichment pipeline may write real-life flags, and it may write nothing else
      if (isLifeFlag(action.flag) !== (action.source === "life")) return reject("life: flags are reserved for real-life enrichment");
      if (state.flags.includes(action.flag)) return same();
      return done({ flags: [...state.flags, action.flag] }, action.flag);
    }
    case "clearFlag": {
      // only reversible case: a corrected (revoked) real-life verification
      if (action.source !== "life" || !isLifeFlag(action.flag)) return reject("only real-life flags can be cleared (corrections)");
      if (!state.flags.includes(action.flag)) return same();
      return done({ flags: state.flags.filter((f) => f !== action.flag) }, action.flag);
    }
    case "discover": {
      if (!action.id) return reject("empty discovery");
      if (state.discoveries.includes(action.id)) return same();
      return done({ discoveries: [...state.discoveries, action.id] }, action.id);
    }
    case "journal": {
      if (!action.id) return reject("empty journal id");
      if (state.journal.some((j) => j.id === action.id)) return same();
      return done({ journal: [...state.journal, { id: action.id, at: now }] }, action.id);
    }
    case "advanceEcho": {
      const from = ECHO_STAGES.indexOf(state.echo);
      const to = ECHO_STAGES.indexOf(action.to);
      if (to < 0) return reject("unknown echo stage");
      if (to === from) return same();
      if (to !== from + 1) return reject("the Echo evolves one stage at a time, forward only");
      return done({ echo: action.to }, `${state.echo}->${action.to}`);
    }
    case "remember": {
      if (!MEMORY_KEY.test(action.key)) return reject("invalid memory key");
      if (typeof action.value === "string" && action.value.length > 64) return reject("memory value too long");
      if (typeof action.value === "number" && !Number.isFinite(action.value)) return reject("invalid memory number");
      const mem = state.memory ?? {};
      if (mem[action.key] === action.value) return same();
      if (!(action.key in mem) && Object.keys(mem).length >= MAX_MEMORY_KEYS) return reject("memory full");
      return done({ memory: { ...mem, [action.key]: action.value } }, `${action.key}=${String(action.value)}`);
    }
    case "count": {
      if (!MEMORY_KEY.test(action.key)) return reject("invalid memory key");
      const by = action.by ?? 1;
      if (!Number.isInteger(by) || by < 1 || by > 100) return reject("invalid count step");
      const mem = state.memory ?? {};
      const cur = mem[action.key];
      if (cur !== undefined && typeof cur !== "number") return reject("memory key is not a counter");
      return done({ memory: { ...mem, [action.key]: (cur ?? 0) + by } }, `${action.key}+${by}`);
    }
  }
}

/** Apply many actions; stops at the first rejection (all-or-nothing for scripted sequences). */
export function applyAll(state: WorldState, actions: Action[], now?: string): ApplyResult {
  let s = state;
  let changed = false;
  for (const a of actions) {
    const r = apply(s, a, now);
    if (!r.ok) return { ok: false, reason: r.reason, state };
    s = r.state;
    changed ||= r.changed;
  }
  return { ok: true, state: s, changed };
}

// ---------------------------------------------------------------- conditions
export type Condition =
  | { flag: string }
  | { discovered: string }
  | { echoAtLeast: EchoStage }
  | { echoIs: EchoStage }
  | { memory: string; equals?: MemoryValue; atLeast?: number }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

export function check(state: WorldState, c: Condition): boolean {
  if ("flag" in c) return state.flags.includes(c.flag);
  if ("discovered" in c) return state.discoveries.includes(c.discovered);
  if ("echoAtLeast" in c) return ECHO_STAGES.indexOf(state.echo) >= ECHO_STAGES.indexOf(c.echoAtLeast);
  if ("echoIs" in c) return state.echo === c.echoIs;
  if ("memory" in c) {
    const v = (state.memory ?? {})[c.memory];
    if (v === undefined) return false;
    if (c.equals !== undefined) return v === c.equals;
    if (c.atLeast !== undefined) return typeof v === "number" && v >= c.atLeast;
    return true;
  }
  if ("all" in c) return c.all.every((x) => check(state, x));
  if ("any" in c) return c.any.some((x) => check(state, x));
  return !check(state, c.not);
}

/** All flags a condition references (used to enforce the accessibility rule). */
export function referencedFlags(c: Condition): string[] {
  if ("flag" in c) return [c.flag];
  if ("all" in c) return c.all.flatMap(referencedFlags);
  if ("any" in c) return c.any.flatMap(referencedFlags);
  if ("not" in c) return referencedFlags(c.not);
  return [];
}
