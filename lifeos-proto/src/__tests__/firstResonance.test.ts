import { describe, it, expect } from "vitest";
import { applyAll, initialWorldState, type WorldState } from "../aetheria/core/state";
import { questStatus, validateQuest } from "../aetheria/core/quests";
import { validateRules, applyLifeEvent, emptyLedger } from "../aetheria/core/enrichment";
import { FORCES } from "../aetheria/core/model";
import * as C from "../aetheria/content/firstResonance";
import { CONSOLES, GALLERY, OBS, STAIR, FLOOR_Y, stepAt, around } from "../aetheria/scenes/sanctuary/layout";
import { MockLifeEventSource } from "../progression/lifeEvents";

const run = (s: WorldState, a: Parameters<typeof applyAll>[1]) => {
  const r = applyAll(s, a);
  expect(r.ok).toBe(true);
  return r.state;
};

describe("The First Resonance — content", () => {
  it("quest and enrichment rules are valid; the quest is essential", () => {
    expect(C.FIRST_RESONANCE.essential).toBe(true);
    expect(validateQuest(C.FIRST_RESONANCE)).toEqual([]);
    expect(validateRules(C.ENRICHMENT_RULES)).toEqual([]);
    for (const j of ["j.sanctuary", "j.fragment", "j.echo", "j.resonance", "j.kingdoms"]) expect(C.JOURNAL[j]?.body.length).toBeGreaterThan(20);
    expect(C.SIGILS).toHaveLength(6);
  });

  it("is completable start-to-finish with NO real-life activity", () => {
    let s = initialWorldState();
    const step = () => (questStatus(C.FIRST_RESONANCE, s) as { index?: number }).index;
    s = run(s, C.onArrive());
    expect(step()).toBe(0);
    s = run(s, C.onObservatory());
    expect(C.canResonate(s)).toBe(false);
    s = run(s, C.onTouchFragment(s));
    expect(s.echo).toBe("silent_observer");
    expect(C.canResonate(s)).toBe(false);
    for (const f of FORCES) s = run(s, C.onAlign(f));
    expect(C.canResonate(s)).toBe(true);
    expect(C.canReadSigils(s)).toBe(false);
    s = run(s, C.onResonanceComplete());
    expect(C.canResonate(s)).toBe(false); // happens once
    s = run(s, C.onTerrace());
    expect(C.canReadSigils(s)).toBe(true);
    s = run(s, C.onReadSigils());
    expect(questStatus(C.FIRST_RESONANCE, s).state).toBe("complete");
    expect(s.discoveries).toEqual(expect.arrayContaining(["first_sanctuary", "observatory", "origin_fragment", "six_kingdoms"]));
    expect(s.flags.some((f) => f.startsWith("life:"))).toBe(false);
    expect(s.journal.map((j) => j.id)).toEqual(["j.sanctuary", "j.fragment", "j.echo", "j.resonance", "j.kingdoms"]);
  });

  it("touching the fragment twice doesn't re-advance the Echo", () => {
    let s = run(initialWorldState(), C.onTouchFragment(initialWorldState()));
    s = run(s, C.onTouchFragment(s));
    expect(s.echo).toBe("silent_observer");
  });

  it("real-life events only add optional memories / glow", () => {
    const src = new MockLifeEventSource();
    let s = initialWorldState();
    let ledger = emptyLedger();
    const r1 = applyLifeEvent(s, ledger, src.emit("milestone_completed", "health"), C.ENRICHMENT_RULES);
    s = r1.state;
    ledger = r1.ledger;
    expect(C.memoryShards(s)).toEqual(["health"]);
    const r2 = applyLifeEvent(s, ledger, src.emit("task_verified", "mind"), C.ENRICHMENT_RULES);
    expect(C.fragmentGlowBoost(r2.state)).toBe(true);
    expect(questStatus(C.FIRST_RESONANCE, r2.state).state).toBe("active"); // no story progress from real life
  });
});

describe("The First Sanctuary — layout", () => {
  const wallInner = OBS.wallR - OBS.wallT / 2;
  it("the stair fits inside the observatory wall and climbs exactly to the gallery", () => {
    for (const z of [STAIR.z0, STAIR.z1])
      for (const x of [STAIR.x - STAIR.width / 2, STAIR.x + STAIR.width / 2]) expect(Math.hypot(x, z)).toBeLessThan(wallInner + 0.05);
    expect(stepAt(STAIR.steps - 1).topY).toBeCloseTo(GALLERY.y, 5);
    expect(STAIR.rise).toBeLessThanOrEqual(0.32); // character autostep height
    const topBearing = (Math.atan2(STAIR.x, -STAIR.z1) * 180) / Math.PI;
    expect(topBearing).toBeGreaterThanOrEqual(GALLERY.from - 2);
    expect(stepAt(0).topY).toBeCloseTo(FLOOR_Y + STAIR.rise, 5);
  });
  it("broken steps are a contiguous middle section (the climb is impossible before the Resonance)", () => {
    const b = STAIR.broken;
    expect(b[0]).toBeGreaterThan(0);
    expect(b[b.length - 1]).toBeLessThan(STAIR.steps - 1);
    for (let i = 1; i < b.length; i++) expect(b[i]).toBe(b[i - 1] + 1);
    // the gap is far above the character's step height
    expect(stepAt(b[b.length - 1] + 1).topY - stepAt(b[0] - 1).topY).toBeGreaterThan(1);
  });
  it("consoles stand on the floor clear of the stair and the pedestal", () => {
    for (const c of CONSOLES) {
      const p = around(c.bearing, c.r);
      expect(Math.hypot(p.x - OBS.x, p.z - OBS.z)).toBeLessThan(OBS.floorR - 0.8);
      expect(Math.abs(p.x - OBS.x - STAIR.x) > STAIR.width / 2 + 0.6 || p.z - OBS.z > STAIR.z0 || p.z - OBS.z < STAIR.z1).toBe(true);
    }
  });
});
