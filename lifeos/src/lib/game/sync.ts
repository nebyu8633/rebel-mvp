"use client";
import { create } from "zustand";
import { useStore } from "../store/store";
import type { BatchOp } from "../store/repo";
import type { DB, XpEvent } from "../types";
import { computeEarned, defaultProfile, levelInfo, milestoneSync, profileOf, reconcile, regionStates, type EarnedEvent } from "./engine";
import { challengesFor } from "./challenges";
import { REGION_BY_ID } from "./regions";
import { nowIso } from "../actions";

export interface Celebration {
  id: string;
  kind: "xp" | "level" | "achievement" | "milestone" | "building" | "challenge";
  title: string;
  detail?: string;
  xp?: number;
}

interface GameUI {
  celebrations: Celebration[];
  push(c: Celebration[]): void;
  shift(): void;
}
export const useCelebrations = create<GameUI>((set, get) => ({
  celebrations: [],
  push: (c) => set({ celebrations: [...get().celebrations, ...c].slice(-8) }),
  shift: () => set({ celebrations: get().celebrations.slice(1) }),
}));

function challengeEvents(db: DB, today: string): EarnedEvent[] {
  const have = db.xpEvents ?? {};
  const out: EarnedEvent[] = [];
  for (const c of challengesFor(db, today)) {
    const id = `chal:${c.id}`;
    if (c.done || have[id]) out.push({ id, kind: "challenge", refId: c.id, title: c.title, amount: c.xp, region: null, attribute: "discipline", at: have[id]?.at ?? nowIso() });
  }
  // keep past challenges (sticky) — they're not recomputed for past days
  for (const e of Object.values(have)) if (e.kind === "challenge" && !out.some((o) => o.id === e.id)) out.push(e);
  return out;
}

let running = false;

/**
 * Bring game state in line with the real data. Idempotent: running it twice changes nothing.
 * Returns what was newly earned so the UI can celebrate it.
 */
export async function runGameSync(today: string): Promise<Celebration[]> {
  if (running) return [];
  running = true;
  try {
    const s = useStore.getState();
    let db = s.db;
    const now = nowIso();
    const ops: BatchOp[] = [];
    if (!profileOf(db)) ops.push({ op: "put", collection: "gameProfile", entity: defaultProfile(today, now) as never });
    // 1. milestones complete (only when unlocked and all tasks verified)
    const msChanges = milestoneSync(db, now);
    for (const m of msChanges) ops.push({ op: "put", collection: "milestones", entity: m as never });
    if (msChanges.length) {
      const ms = { ...db.milestones };
      for (const m of msChanges) ms[m.id] = m;
      db = { ...db, milestones: ms };
    }
    // 2. ledger
    const before = Object.values(db.xpEvents ?? {});
    const earned = [...computeEarned(db, profileOf(db), today), ...challengeEvents(db, today)];
    const r = reconcile(db, earned, now);
    for (const e of r.put) ops.push({ op: "put", collection: "xpEvents", entity: e as never });
    for (const id of r.remove) ops.push({ op: "remove", collection: "xpEvents", id });
    if (!ops.length) return [];
    const res = await s.applyBatch(ops, { silent: true });
    if (!res.ok) return [];
    return celebrationsFor(before, Object.values(useStore.getState().db.xpEvents), r.gained, msChanges.filter((m) => m.status === "done").map((m) => m.id));
  } finally {
    running = false;
  }
}

function celebrationsFor(before: XpEvent[], after: XpEvent[], gained: XpEvent[], milestonesDone: string[]): Celebration[] {
  const out: Celebration[] = [];
  const sum = (l: XpEvent[]) => l.reduce((s, e) => s + e.amount, 0);
  const l0 = levelInfo(sum(before)).level;
  const l1 = levelInfo(sum(after)).level;
  for (const g of gained) {
    if (g.kind === "achievement") out.push({ id: g.id, kind: "achievement", title: g.title, xp: g.amount });
    else if (g.kind === "milestone" && milestonesDone.includes(g.refId)) out.push({ id: g.id, kind: "milestone", title: g.title, xp: g.amount });
    else if (g.kind === "challenge") out.push({ id: g.id, kind: "challenge", title: g.title, xp: g.amount });
  }
  const rs0 = regionStates(before);
  const rs1 = regionStates(after);
  for (const id of Object.keys(rs1) as Array<keyof typeof rs1>) {
    if (rs1[id].stage > rs0[id].stage) {
      const def = REGION_BY_ID[id];
      out.push({ id: `b:${id}:${rs1[id].stage}`, kind: "building", title: def.stages[rs1[id].stage - 1].building, detail: def.name });
    }
  }
  if (l1 > l0) out.push({ id: `lvl:${l1}`, kind: "level", title: `רמה ${l1}` });
  const plain = gained.filter((g) => g.kind === "task" || g.kind === "occurrence" || g.kind === "habit" || g.kind === "goal" || g.kind === "chest");
  if (plain.length) out.push({ id: `xp:${plain.map((g) => g.id).join(",")}`, kind: "xp", title: "", xp: sum(plain) });
  return out;
}
