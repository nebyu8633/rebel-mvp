import { describe, it, expect } from "vitest";
import { apply, applyAll, initialWorldState, RESONANCE_REJECT, type Action, type WorldState } from "../aetheria/core/state";
import { questStatus, validateQuest } from "../aetheria/core/quests";
import { choose, enterActions, validateDialogue, viewNode } from "../aetheria/core/dialogue";
import { FORCES } from "../aetheria/core/model";
import * as C from "../aetheria/content/firstResonance";
import { E, ECHO_TALK } from "../aetheria/content/echoAwakening";
import { G, SITE, SLEEPING_GATE, GATE_SITES, onLearn, onGateFound, REJECT_TEXT } from "../aetheria/content/sleepingGate";
import { RULES, JOURNAL, currentQuest } from "../aetheria/content/index";
import { parseSave, newSave } from "../save/saveStore";
import { GATE, gateStep, nearGate } from "../aetheria/scenes/sanctuary/layout";

const run = (s: WorldState, a: Action[]) => {
  const r = applyAll(s, a, undefined, RULES);
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};
const res = (s: WorldState, site: string, force: (typeof FORCES)[number]) => apply(s, { type: "resonate", site, force }, undefined, RULES);

function afterBond(): WorldState {
  let s = initialWorldState();
  s = run(s, C.onArrive());
  s = run(s, C.onObservatory());
  s = run(s, C.onTouchFragment(s));
  for (const f of FORCES) s = run(s, C.onAlign(f));
  s = run(s, [...C.onResonanceComplete(), ...C.onTerrace(), ...C.onReadSigils()]);
  return run(s, [{ type: "setFlag", flag: E.approached }, { type: "advanceEcho", to: "fragmented_mind" }, { type: "setFlag", flag: E.firstWords }, { type: "remember", key: "echo.bond", value: "form" }, { type: "setFlag", flag: E.bondChosen }]);
}

describe("resonance engine", () => {
  it("rejects every invalid use of a power with a reason the UI can explain", () => {
    let s = afterBond();
    expect(res(s, SITE.steps, "form")).toMatchObject({ ok: false, reason: RESONANCE_REJECT.notLearned });
    s = run(s, FORCES.map((f) => ({ type: "learnPower", force: f }) as Action));
    expect(res(s, "nowhere", "form")).toMatchObject({ ok: false, reason: RESONANCE_REJECT.unknownSite });
    expect(apply(s, { type: "resonate", site: SITE.steps, force: "form" })).toMatchObject({ ok: false, reason: RESONANCE_REJECT.unknownSite }); // no rules, no change
    expect(res(s, SITE.steps, "change")).toMatchObject({ ok: false, reason: RESONANCE_REJECT.noEffect });
    expect(res(s, SITE.pillar, "change")).toMatchObject({ ok: false, reason: RESONANCE_REJECT.notReady });
    s = run(s, [{ type: "resonate", site: SITE.steps, force: "form" }]);
    expect(res(s, SITE.steps, "form")).toMatchObject({ ok: false, reason: RESONANCE_REJECT.done });
    for (const code of Object.values(RESONANCE_REJECT).filter((c) => c !== RESONANCE_REJECT.unknownSite)) expect(REJECT_TEXT[code]).toBeTruthy();
  });

  it("learning is idempotent and only known forces can be learned", () => {
    let s = run(initialWorldState(), [{ type: "learnPower", force: "change" }]);
    const again = apply(s, { type: "learnPower", force: "change" });
    expect(again.ok && again.changed).toBe(false);
    expect(apply(s, { type: "learnPower", force: "fire" as never }).ok).toBe(false);
    s = run(s, [{ type: "learnPower", force: "form" }]);
    expect(s.powers).toEqual(["change", "form"]);
  });

  it("consequences are atomic: a failing consequence leaves the world untouched", () => {
    const rules = { sites: { x: { id: "x", title: "x", initial: "a", transitions: [{ force: "form" as const, from: "a", to: "b", then: [{ type: "advanceEcho", to: "future_companion" } as Action] }] } } };
    const s = run(initialWorldState(), [{ type: "learnPower", force: "form" }]);
    const r = apply(s, { type: "resonate", site: "x", force: "form" }, undefined, rules);
    expect(r.ok).toBe(false);
    expect(r.state.sites).toEqual({});
  });

  it("old saves without powers/sites still load", () => {
    const old = newSave() as unknown as { world: Record<string, unknown> };
    delete old.world.powers;
    delete old.world.sites;
    const r = parseSave(JSON.parse(JSON.stringify(old)));
    expect(r.ok && r.data.world.powers).toEqual([]);
    expect(r.ok && r.data.world.sites).toEqual({});
  });
});

describe("The Sleeping Gate — story", () => {
  it("content is valid and essential", () => {
    expect(validateQuest(SLEEPING_GATE)).toEqual([]);
    expect(validateDialogue(ECHO_TALK)).toEqual([]);
    for (const j of ["j.powers", "j.form", "j.change", "j.gate", "j.companion"]) expect(JOURNAL[j]?.body.length).toBeGreaterThan(20);
    expect(Object.keys(GATE_SITES).every((k) => RULES.sites[k])).toBe(true);
  });

  it("is completable with NO real-life activity: learn → find → form → change → connect → tell the Echo", () => {
    let s = afterBond();
    expect(currentQuest(s).id).toBe("sleeping_gate");
    for (const f of FORCES) s = run(s, onLearn(s, f));
    expect(s.journal.filter((j) => j.id === "j.powers")).toHaveLength(1);
    s = run(s, onGateFound());
    s = run(s, [{ type: "resonate", site: SITE.steps, force: "form" }]);
    s = run(s, [{ type: "resonate", site: SITE.pillar, force: "change" }]);
    expect(s.flags).not.toContain(G.awake);
    s = run(s, [{ type: "resonate", site: SITE.link, force: "connection" }]);
    expect(s.flags).toContain(G.awake);
    expect(s.discoveries).toContain("sleeping_gate");
    expect((questStatus(SLEEPING_GATE, s) as { step?: { id: string } }).step?.id).toBe("tell");

    // the Echo offers the gate choice, which evolves it into the Future Companion
    expect(viewNode(ECHO_TALK, "start", s)!.choices.map((c) => c.id)).toContain("gate");
    let node: string | null = "start";
    let pick: string | null = "gate";
    while (node && node !== "menu") {
      s = run(s, enterActions(ECHO_TALK, node));
      const r = choose(ECHO_TALK, node, pick, s);
      if (!r.ok) throw new Error(r.reason);
      s = run(s, r.actions);
      node = r.next;
      pick = null;
    }
    expect(s.echo).toBe("future_companion");
    expect(questStatus(SLEEPING_GATE, s).state).toBe("complete");
    expect(viewNode(ECHO_TALK, "start", s)!.choices.map((c) => c.id)).not.toContain("gate");
    expect(s.flags.some((f) => f.startsWith("life:"))).toBe(false);
    expect(s.history.some((h) => h.action === "resonate")).toBe(true);
  });
});

describe("The Sleeping Gate — layout", () => {
  it("the dais can't be jumped onto, and the FORM steps can be climbed", () => {
    const apex = 5.4 ** 2 / (2 * 20);
    expect(GATE.h).toBeGreaterThan(apex + 0.32 + 0.2);
    const rises = Array.from({ length: GATE.steps }, (_, i) => gateStep(i).topY - (i ? gateStep(i - 1).topY : 0));
    for (const r of rises) expect(r).toBeLessThanOrEqual(0.32);
    expect(gateStep(GATE.steps - 1).topY).toBeCloseTo(GATE.h);
    expect(nearGate(GATE.x, GATE.z)).toBe(true);
    expect(nearGate(0, -6)).toBe(false);
  });
});

import { fragmentStage, FRAGMENT_STAGES } from "../aetheria/content/originFragment";
describe("The Origin Fragment — stages", () => {
  it("evolves forward with the story and never depends on real life", () => {
    let s = initialWorldState();
    const seen = [fragmentStage(s)];
    s = run(s, C.onArrive());
    s = run(s, C.onObservatory());
    s = run(s, C.onTouchFragment(s));
    seen.push(fragmentStage(s));
    for (const f of FORCES) s = run(s, C.onAlign(f));
    s = run(s, C.onResonanceComplete());
    seen.push(fragmentStage(s));
    s = run(s, FORCES.map((f) => ({ type: "learnPower", force: f }) as Action));
    seen.push(fragmentStage(s));
    s = run(s, [{ type: "advanceEcho", to: "fragmented_mind" }, { type: "advanceEcho", to: "future_companion" }]);
    seen.push(fragmentStage(s));
    expect(seen).toEqual([...FRAGMENT_STAGES]);
    // a real-life flag changes nothing about the stage
    const withLife = { ...s, flags: [...s.flags, "life:world_detail.fragment_glow"] };
    expect(fragmentStage(withLife)).toBe("transcendence");
  });
});

import { BRIDGE_QUEST, MEMORY_QUEST, D, LENS_SITE, MEMORIES, memoriesFound, memoryVisible, onIsle, onMemory, onThreshold } from "../aetheria/content/worldDepth";
import { ISLE, BRIDGE_PATH, MEMORY_SPOTS, STAR_LENS, BOUND_R as BR, OBS as O } from "../aetheria/scenes/sanctuary/layout";
describe("World Depth", () => {
  const awakeWorld = () => {
    let s = afterBond();
    s = run(s, FORCES.map((f) => ({ type: "learnPower", force: f }) as Action));
    return run(s, [{ type: "resonate", site: SITE.steps, force: "form" }, { type: "resonate", site: SITE.pillar, force: "change" }, { type: "resonate", site: SITE.link, force: "connection" }]);
  };
  it("content is valid; the bridge quest is essential and free of real life", () => {
    expect(validateQuest(BRIDGE_QUEST)).toEqual([]);
    expect(validateQuest(MEMORY_QUEST)).toEqual([]);
    expect(BRIDGE_QUEST.essential).toBe(true);
    expect(validateDialogue(ECHO_TALK)).toEqual([]);
    for (const j of ["j.memory_colonnade", "j.memory_south_rim", "j.memory_star_chart", "j.lens", "j.isle", "j.threshold"]) expect(JOURNAL[j]?.body.length).toBeGreaterThan(20);
  });
  it("the bridge quest completes after the gate wakes", () => {
    let s = awakeWorld();
    expect(questStatus(BRIDGE_QUEST, s).state).toBe("active");
    s = run(s, [...onIsle(), ...onThreshold()]);
    expect(questStatus(BRIDGE_QUEST, s).state).toBe("complete");
    expect(s.discoveries).toEqual(expect.arrayContaining(["floating_isle", "first_threshold"]));
  });
  it("the third memory only exists once CHANGE makes the star lens whole", () => {
    let s = run(awakeWorld(), [...onMemory(awakeWorld(), "memory_colonnade"), ...onMemory(awakeWorld(), "memory_south_rim")]);
    expect(memoriesFound(s)).toBe(2);
    expect(memoryVisible(s, "memory_star_chart")).toBe(false);
    expect(onMemory(s, "memory_star_chart")).toEqual([]); // nothing to pick up yet
    expect(res(s, LENS_SITE, "form")).toMatchObject({ ok: false, reason: RESONANCE_REJECT.noEffect });
    s = run(s, [{ type: "resonate", site: LENS_SITE, force: "change" }]);
    expect(s.flags).toContain(D.lens);
    s = run(s, onMemory(s, "memory_star_chart"));
    expect(memoriesFound(s)).toBe(MEMORIES.length);
    expect(questStatus(MEMORY_QUEST, s).state).toBe("complete");
    expect(viewNode(ECHO_TALK, "start", { ...s, echo: "future_companion" })!.text).toContain("שלושת הזיכרונות");
  });
  it("layout: the bridge reaches the isle top, spots are inside the island, the lens is on the gallery", () => {
    expect(BRIDGE_PATH[BRIDGE_PATH.length - 1][1]).toBeCloseTo(ISLE.top);
    const end = BRIDGE_PATH[BRIDGE_PATH.length - 1];
    expect(Math.hypot(end[0] - ISLE.x, end[2] - ISLE.z)).toBeLessThan(ISLE.r);
    // no climb steeper than the controller can walk (46°)
    for (let i = 1; i < BRIDGE_PATH.length; i++) {
      const [a, b] = [BRIDGE_PATH[i - 1], BRIDGE_PATH[i]];
      expect(Math.atan2(b[1] - a[1], Math.hypot(b[0] - a[0], b[2] - a[2])) * 180 / Math.PI).toBeLessThan(35);
    }
    for (const p of Object.values(MEMORY_SPOTS)) expect(Math.hypot(p.x, p.z)).toBeLessThan(BR - 1);
    expect(Math.hypot(STAR_LENS.x - O.x, STAR_LENS.z - O.z)).toBeGreaterThan(5.6);
  });
});

import { KNOWLEDGE_QUEST, K, SEAL_SITE, onEnterKingdom, CODEX_SITE, DIALS, DIAL_SYMBOLS, DIAL_TARGET, dialSite } from "../aetheria/content/knowledgeKingdom";
import { PATHS, SATELLITES, HALL, LANDING } from "../aetheria/scenes/knowledge/layout";
describe("The Kingdom of Knowledge", () => {
  const atThreshold = () => {
    let s = afterBond();
    s = run(s, FORCES.map((f) => ({ type: "learnPower", force: f }) as Action));
    s = run(s, [{ type: "resonate", site: SITE.steps, force: "form" }, { type: "resonate", site: SITE.pillar, force: "change" }, { type: "resonate", site: SITE.link, force: "connection" }]);
    return run(s, [...onIsle(), ...onThreshold()]);
  };
  it("the seal answers the three forces only in order", () => {
    let s = atThreshold();
    expect(validateQuest(KNOWLEDGE_QUEST)).toEqual([]);
    expect(KNOWLEDGE_QUEST.essential).toBe(true);
    expect(questStatus(KNOWLEDGE_QUEST, s).state).toBe("active");
    expect(res(s, SEAL_SITE, "connection")).toMatchObject({ ok: false, reason: RESONANCE_REJECT.noEffect });
    expect(res(s, SEAL_SITE, "change")).toMatchObject({ ok: false, reason: RESONANCE_REJECT.noEffect });
    s = run(s, [{ type: "resonate", site: SEAL_SITE, force: "form" }]);
    expect(res(s, SEAL_SITE, "form")).toMatchObject({ ok: false, reason: RESONANCE_REJECT.done });
    s = run(s, [{ type: "resonate", site: SEAL_SITE, force: "change" }]);
    expect(s.flags).not.toContain(K.open);
    s = run(s, [{ type: "resonate", site: SEAL_SITE, force: "connection" }]);
    expect(s.flags).toContain(K.open);
    s = run(s, onEnterKingdom());
    expect((questStatus(KNOWLEDGE_QUEST, s) as { step?: { id: string } }).step?.id).toBe("dials");

    // the Hall of Patterns: the codex won't open before every dial points at its symbol
    expect(res(s, CODEX_SITE, "connection")).toMatchObject({ ok: false, reason: RESONANCE_REJECT.notReady });
    expect(res(s, dialSite("west"), "form")).toMatchObject({ ok: false, reason: RESONANCE_REJECT.noEffect });
    for (const d of DIALS) for (let k = 0; k < DIAL_TARGET[d]; k++) s = run(s, [{ type: "resonate", site: dialSite(d), force: "change" }]);
    expect(DIALS.every((d) => s.sites[dialSite(d)] === `p${DIAL_TARGET[d]}`)).toBe(true);
    // one turn too many breaks the pattern again; a full turn brings it back
    let over = run(s, [{ type: "resonate", site: dialSite("north"), force: "change" }]);
    expect(res(over, CODEX_SITE, "connection")).toMatchObject({ ok: false, reason: RESONANCE_REJECT.notReady });
    for (let k = 1; k < DIAL_SYMBOLS; k++) over = run(over, [{ type: "resonate", site: dialSite("north"), force: "change" }]);
    expect(over.sites[dialSite("north")]).toBe(`p${DIAL_TARGET.north}`);
    s = run(s, [{ type: "resonate", site: CODEX_SITE, force: "connection" }]);
    expect(s.flags).toContain(K.codex);
    expect(questStatus(KNOWLEDGE_QUEST, s).state).toBe("complete");
    expect(viewNode(ECHO_TALK, "start", s)!.text).toContain("הקודקס פתוח");
    expect(s.flags.some((f) => f.startsWith("life:"))).toBe(false);
  });
  it("layout: every path is walkable and joins two platforms", () => {
    expect(PATHS).toHaveLength(1 + SATELLITES.length);
    for (const p of PATHS) {
      for (let i = 1; i < p.length; i++) {
        const [a, b] = [p[i - 1], p[i]];
        expect((Math.atan2(Math.abs(b[1] - a[1]), Math.hypot(b[0] - a[0], b[2] - a[2])) * 180) / Math.PI).toBeLessThan(35);
      }
    }
    const first = PATHS[0];
    expect(Math.hypot(first[0][0] - LANDING.x, first[0][2] - LANDING.z)).toBeLessThan(LANDING.r);
    expect(Math.hypot(first[2][0] - HALL.x, first[2][2] - HALL.z)).toBeLessThan(HALL.r);
  });
});
