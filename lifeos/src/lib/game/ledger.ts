/** Ledger helpers shared by the browser (local mode) and the server (cloud mode). Pure. */
import type { DB } from "../types";
import type { EarnedEvent } from "./engine";
import { challengesFor } from "./challenges";

export function challengeEvents(db: DB, today: string, now: string): EarnedEvent[] {
  const have = db.xpEvents ?? {};
  const out: EarnedEvent[] = [];
  for (const c of challengesFor(db, today)) {
    const id = `chal:${c.id}`;
    if (c.done || have[id]) out.push({ id, kind: "challenge", refId: c.id, title: c.title, amount: c.xp, region: null, attribute: "discipline", at: have[id]?.at ?? now });
  }
  // past challenges are sticky — they're not recomputed for past days
  for (const e of Object.values(have)) if (e.kind === "challenge" && !out.some((o) => o.id === e.id)) out.push(e);
  return out;
}
