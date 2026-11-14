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

import { HEALTH_QUEST, H, HEART_SITE, SPRINGS, springSite, onEnterGrove } from "../aetheria/content/healthKingdom";
import { SPRING_SPOTS, GIANTS, HEART, BOUND_R as HBR, SPAWN as HSPAWN } from "../aetheria/scenes/health/layout";
import { LIVING_PATH } from "../aetheria/scenes/knowledge/layout";
describe("The Kingdom of Health", () => {
  it("the Heart Tree blooms only when all three springs are channelled", () => {
    let s = run(initialWorldState(), [{ type: "setFlag", flag: K.codex }, ...FORCES.map((f) => ({ type: "learnPower", force: f }) as Action)]);
    expect(validateQuest(HEALTH_QUEST)).toEqual([]);
    expect(HEALTH_QUEST.essential).toBe(true);
    expect(questStatus(HEALTH_QUEST, s).state).toBe("active");
    s = run(s, onEnterGrove());
    expect(res(s, springSite("west"), "connection")).toMatchObject({ ok: false, reason: RESONANCE_REJECT.noEffect }); // dry: nothing to channel
    expect(res(s, HEART_SITE, "form")).toMatchObject({ ok: false, reason: RESONANCE_REJECT.notReady });
    for (const sp of SPRINGS) s = run(s, [{ type: "resonate", site: springSite(sp), force: "change" }]);
    expect((questStatus(HEALTH_QUEST, s) as { step?: { id: string } }).step?.id).toBe("channel");
    for (const sp of SPRINGS.slice(0, 2)) s = run(s, [{ type: "resonate", site: springSite(sp), force: "connection" }]);
    expect(res(s, HEART_SITE, "form")).toMatchObject({ ok: false, reason: RESONANCE_REJECT.notReady });
    s = run(s, [{ type: "resonate", site: springSite("east"), force: "connection" }]);
    s = run(s, [{ type: "resonate", site: HEART_SITE, force: "form" }]);
    expect(s.flags).toContain(H.bloomed);
    expect(questStatus(HEALTH_QUEST, s).state).toBe("complete");
    expect(s.memory["world.springs_revived"]).toBe(3);
  });
  it("layout: springs, giants and the path keep clear of each other; the gate path is walkable", () => {
    for (const sp of Object.values(SPRING_SPOTS)) {
      expect(Math.hypot(sp.x, sp.z)).toBeLessThan(HBR - 3);
      for (const g of GIANTS) expect(Math.hypot(sp.x - g.x, sp.z - g.z)).toBeGreaterThan(g.r * 2.5 + sp.r + 1);
    }
    for (const g of GIANTS) expect(Math.abs(g.x) > 3 || g.z < HEART.z).toBe(true); // not on the arrival path
    expect(HSPAWN.z).toBeLessThan(HBR);
    for (let i = 1; i < LIVING_PATH.length; i++) {
      const [a, b] = [LIVING_PATH[i - 1], LIVING_PATH[i]];
      expect((Math.atan2(Math.abs(b[1] - a[1]), Math.hypot(b[0] - a[0], b[2] - a[2])) * 180) / Math.PI).toBeLessThan(35);
    }
  });
});

import { MIND_QUEST, M, CORE_SITE, LANTERNS, lanternSite, onEnterMind } from "../aetheria/content/mindKingdom";
import { BRIDGES, ISLANDS, LANTERN_SPOTS } from "../aetheria/scenes/mind/layout";
import { DREAMS_GATE, SPRING_SPOTS as SP2 } from "../aetheria/scenes/health/layout";
describe("The Kingdom of the Mind", () => {
  it("bridges become real one after another; the Mind wakes only when all are real", () => {
    let s = run(initialWorldState(), [{ type: "setFlag", flag: H.bloomed }, ...FORCES.map((f) => ({ type: "learnPower", force: f }) as Action)]);
    expect(validateQuest(MIND_QUEST)).toEqual([]);
    expect(MIND_QUEST.essential).toBe(true);
    s = run(s, onEnterMind());
    expect(res(s, lanternSite("second"), "change")).toMatchObject({ ok: false, reason: RESONANCE_REJECT.notReady });
    expect(res(s, lanternSite("first"), "form")).toMatchObject({ ok: false, reason: RESONANCE_REJECT.noEffect });
    expect(res(s, CORE_SITE, "connection")).toMatchObject({ ok: false, reason: RESONANCE_REJECT.notReady });
    for (const l of LANTERNS) s = run(s, [{ type: "resonate", site: lanternSite(l), force: "change" }]);
    expect(s.memory["world.bridges_realised"]).toBe(3);
    s = run(s, [{ type: "resonate", site: CORE_SITE, force: "connection" }]);
    expect(s.flags).toContain(M.awake);
    expect(questStatus(MIND_QUEST, s).state).toBe("complete");
    expect(viewNode(ECHO_TALK, "start", s)!.text).toContain("שני הצדדים של המראה");
  });
  it("layout: bridges walkable, lanterns on their islands and off the bridges, the dreams gate clear", () => {
    for (const b of BRIDGES) {
      const [a, c] = [b[0], b[b.length - 1]];
      expect((Math.atan2(Math.abs(c[1] - a[1]), Math.hypot(c[0] - a[0], c[2] - a[2])) * 180) / Math.PI).toBeLessThan(25);
    }
    const isl = [ISLANDS.first, ISLANDS.second, ISLANDS.third];
    LANTERN_SPOTS.forEach((p, i) => {
      expect(Math.hypot(p.x - isl[i].x, p.z - isl[i].z)).toBeLessThan(isl[i].r - 0.5);
      expect(Math.hypot(p.x - BRIDGES[i][0][0], p.z - BRIDGES[i][0][2])).toBeGreaterThan(1.8);
    });
    for (const sp of Object.values(SP2)) expect(Math.hypot(sp.x - DREAMS_GATE.x, sp.z - DREAMS_GATE.z)).toBeGreaterThan(6);
  });
});

import { CAREER_QUEST, C as CK, GEARS, gearSite, LEVER_SITE, CRANE_SITE, onEnterWorks, onBlueprint } from "../aetheria/content/careerKingdom";
import { SPAN, TOWER, WORKS, GEAR_WALL, LEVER as LV, CRANE as CR } from "../aetheria/scenes/career/layout";
import { WORKS_DOOR, ISLANDS as MI } from "../aetheria/scenes/mind/layout";
describe("The Kingdom of Career", () => {
  it("gears (any order) -> lever -> girder -> blueprint", () => {
    let s = run(initialWorldState(), [{ type: "setFlag", flag: M.awake }, ...FORCES.map((f) => ({ type: "learnPower", force: f }) as Action)]);
    expect(validateQuest(CAREER_QUEST)).toEqual([]);
    expect(CAREER_QUEST.essential).toBe(true);
    s = run(s, onEnterWorks());
    expect(res(s, LEVER_SITE, "change")).toMatchObject({ ok: false, reason: RESONANCE_REJECT.notReady });
    expect(res(s, CRANE_SITE, "connection")).toMatchObject({ ok: false, reason: RESONANCE_REJECT.notReady });
    expect(res(s, gearSite("left"), "change")).toMatchObject({ ok: false, reason: RESONANCE_REJECT.noEffect });
    for (const g of [...GEARS].reverse()) s = run(s, [{ type: "resonate", site: gearSite(g), force: "form" }]);
    s = run(s, [{ type: "resonate", site: LEVER_SITE, force: "change" }, { type: "resonate", site: CRANE_SITE, force: "connection" }]);
    s = run(s, onBlueprint());
    expect(s.flags).toContain(CK.blueprint);
    expect(questStatus(CAREER_QUEST, s).state).toBe("complete");
    expect(s.memory["world.gears_forged"]).toBe(3);
  });
  it("layout: the span is level, starts on the platform and lands on the tower; the door stands on the core island", () => {
    expect(SPAN.from[1]).toBe(SPAN.to[1]);
    expect(Math.hypot(SPAN.from[0] - WORKS.x, SPAN.from[2] - WORKS.z)).toBeLessThan(WORKS.r - 0.5);
    expect(Math.hypot(SPAN.to[0] - TOWER.x, SPAN.to[2] - TOWER.z)).toBeLessThan(TOWER.r - 0.5);
    for (const p of [LV, CR, ...GEAR_WALL.sockets.map((x) => ({ x, z: GEAR_WALL.z + 1.6 }))]) expect(Math.hypot(p.x - WORKS.x, p.z - WORKS.z)).toBeLessThan(WORKS.r - 1);
    // the machine's face leaves a way (>= 3 m) round its west end to the girder
    const westEnd = GEAR_WALL.x - GEAR_WALL.width / 2;
    const halfWidthAtWall = Math.sqrt(WORKS.r ** 2 - (GEAR_WALL.z - 1 - WORKS.z) ** 2);
    expect(westEnd - (WORKS.x - halfWidthAtWall)).toBeGreaterThan(3);
    expect(CR.x).toBeLessThan(westEnd);
    expect(Math.hypot(WORKS_DOOR.x - MI.core.x, WORKS_DOOR.z - MI.core.z)).toBeLessThan(MI.core.r - 1);
  });
});

import { SOCIAL_QUEST, S as SK, HAMLETS, bridgeSite, bellFlag, HEARTH_SITE, ECHO_HELPS, onEnterVillage, onBell, onKeepers } from "../aetheria/content/socialKingdom";
import { VILLAGE_BRIDGES, KEEPER_STONES, HEARTH as HH, PLAZA, HAMLET_SPOTS, GATHER } from "../aetheria/scenes/social/layout";
import { HEARTH_GATE, TOWER as TW } from "../aetheria/scenes/career/layout";
describe("The Kingdom of Social", () => {
  it("bridges, bells, two keepers (you and the Echo, when asked), then the flame", () => {
    let s = run(initialWorldState(), [{ type: "setFlag", flag: CK.blueprint }, { type: "advanceEcho", to: "silent_observer" }, { type: "advanceEcho", to: "fragmented_mind" }, { type: "advanceEcho", to: "future_companion" }, ...FORCES.map((f) => ({ type: "learnPower", force: f }) as Action)]);
    expect(validateQuest(SOCIAL_QUEST)).toEqual([]);
    expect(SOCIAL_QUEST.essential).toBe(true);
    s = run(s, onEnterVillage());
    expect(res(s, HEARTH_SITE, "form")).toMatchObject({ ok: false, reason: RESONANCE_REJECT.notReady });
    for (const h of HAMLETS) s = run(s, [{ type: "resonate", site: bridgeSite(h), force: "connection" }, ...onBell(h)]);
    // the Echo offers to help only once the people are back, and only when asked
    expect(viewNode(ECHO_TALK, "start", s)!.choices.map((c) => c.id)).toContain("keep");
    expect(res(s, HEARTH_SITE, "form")).toMatchObject({ ok: false, reason: RESONANCE_REJECT.notReady });
    const r = choose(ECHO_TALK, "start", "keep", s);
    expect(r.ok).toBe(true);
    if (r.ok) s = run(s, r.actions);
    expect(s.memory[ECHO_HELPS]).toBe(true);
    expect(viewNode(ECHO_TALK, "start", s)!.choices.map((c) => c.id)).not.toContain("keep");
    s = run(s, onKeepers());
    s = run(s, [{ type: "resonate", site: HEARTH_SITE, force: "form" }]);
    expect(s.flags).toContain(SK.flame);
    expect(questStatus(SOCIAL_QUEST, s).state).toBe("complete");
    expect(s.memory["world.bells_rung"]).toBe(3);
  });
  it("layout: bridges walkable, keepers' stones either side of the hearth, the gate on the tower platform", () => {
    for (const b of Object.values(VILLAGE_BRIDGES)) {
      const [a, c] = [b[0], b[b.length - 1]];
      expect((Math.atan2(Math.abs(c[1] - a[1]), Math.hypot(c[0] - a[0], c[2] - a[2])) * 180) / Math.PI).toBeLessThan(20);
    }
    for (const k of Object.values(KEEPER_STONES)) expect(Math.hypot(k.x - HH.x, k.z - HH.z)).toBeGreaterThan(HH.r + 1.5);
    expect(Math.hypot(KEEPER_STONES.player.x - KEEPER_STONES.echo.x, KEEPER_STONES.player.z - KEEPER_STONES.echo.z)).toBeGreaterThan(6);
    for (const g of GATHER) expect(Math.hypot(g.x, g.z)).toBeLessThan(PLAZA.r - 1);
    for (const h of Object.values(HAMLET_SPOTS)) expect(Math.hypot(h.x, h.z) - h.r - PLAZA.r).toBeGreaterThan(4);
    expect(Math.hypot(HEARTH_GATE.x - TW.x, HEARTH_GATE.z - TW.z)).toBeLessThan(TW.r - 1);
  });
});

import { WEALTH_QUEST, FINALE_QUEST, W as WK, PLINTHS, plinthSite, VAULT_SITE, ORIGIN_SITE, onEnterVault, onShard, onReturnToOrigin } from "../aetheria/content/wealthKingdom";
import { K as KK } from "../aetheria/content/knowledgeKingdom";
import { M as MK } from "../aetheria/content/mindKingdom";
import { TERRACE, VAULT as VT, SCALE as SC, PLINTH_SPOTS, SHARD as SH, SPAWN as WSPAWN, WAYSTONE as WWS } from "../aetheria/scenes/wealth/layout";
import { GOLD_GATE, GOLD_GATE_ARRIVAL } from "../aetheria/scenes/social/layout";
import { ORIGIN_ARRIVAL, insideObservatory } from "../aetheria/scenes/sanctuary/layout";
describe("The Kingdom of Wealth and the finale", () => {
  const start = () => run(initialWorldState(), [{ type: "setFlag", flag: SK.flame }, ...FORCES.map((f) => ({ type: "learnPower", force: f }) as Action)]);
  it("refine (CHANGE) before carrying (CONNECTION); the vault refuses until the scale balances", () => {
    expect(validateQuest(WEALTH_QUEST)).toEqual([]);
    expect(WEALTH_QUEST.essential).toBe(true);
    let s = run(start(), onEnterVault());
    expect(res(s, plinthSite("west"), "connection")).toMatchObject({ ok: false });
    expect(res(s, VAULT_SITE, "form")).toMatchObject({ ok: false, reason: RESONANCE_REJECT.notReady });
    for (const p of PLINTHS) s = run(s, [{ type: "resonate", site: plinthSite(p), force: "change" }]);
    expect(res(s, VAULT_SITE, "form")).toMatchObject({ ok: false, reason: RESONANCE_REJECT.notReady });
    for (const p of PLINTHS) s = run(s, [{ type: "resonate", site: plinthSite(p), force: "connection" }]);
    expect(s.memory["world.ingots_weighed"]).toBe(3);
    s = run(s, [{ type: "resonate", site: VAULT_SITE, force: "form" }]);
    s = run(s, onShard());
    expect(s.flags).toContain(WK.shard);
    expect(questStatus(WEALTH_QUEST, s).state).toBe("complete");
  });
  it("the finale joins only when all six kingdoms are restored", () => {
    let s = run(start(), [...onShard(), ...onReturnToOrigin()]);
    expect(validateQuest(FINALE_QUEST)).toEqual([]);
    expect(res(s, ORIGIN_SITE, "connection")).toMatchObject({ ok: false, reason: RESONANCE_REJECT.notReady });
    s = run(s, [KK.codex, H.bloomed, MK.awake].map((flag) => ({ type: "setFlag", flag }) as Action));
    expect(res(s, ORIGIN_SITE, "connection")).toMatchObject({ ok: false, reason: RESONANCE_REJECT.notReady });
    s = run(s, [{ type: "setFlag", flag: CK.blueprint }, { type: "resonate", site: ORIGIN_SITE, force: "connection" }]);
    expect(s.flags).toContain(WK.restored);
    expect(questStatus(FINALE_QUEST, s).state).toBe("complete");
    expect(JOURNAL["j.restored"]).toBeTruthy();
    expect(res(s, ORIGIN_SITE, "connection")).toMatchObject({ ok: false });
  });
  it("layout: everything stands on the terrace, the shard inside the vault, arrivals land safely", () => {
    const onTerrace = (p: { x: number; z: number }, m = 1.5) => Math.hypot(p.x - TERRACE.x, p.z - TERRACE.z) < TERRACE.r - m;
    for (const p of Object.values(PLINTH_SPOTS)) {
      expect(onTerrace(p, 2.5)).toBe(true);
      expect(Math.hypot(p.x - SC.x, p.z - SC.z)).toBeGreaterThan(SC.beam / 2 + SC.panR + 1.5);
    }
    expect(onTerrace(WSPAWN)).toBe(true);
    expect(onTerrace(WWS)).toBe(true);
    expect(SH.z).toBeLessThan(VT.z - 3); // behind the 3 m facade
    expect(Math.abs(SH.x - VT.x)).toBeLessThan(VT.doorR);
    expect(Math.hypot(GOLD_GATE.x, GOLD_GATE.z)).toBeLessThan(PLAZA.r - 1.5);
    expect(Math.hypot(GOLD_GATE_ARRIVAL.x, GOLD_GATE_ARRIVAL.z)).toBeLessThan(Math.hypot(GOLD_GATE.x, GOLD_GATE.z));
    expect(Math.hypot(GOLD_GATE.x - HH.x, GOLD_GATE.z - HH.z)).toBeGreaterThan(7);
    expect(insideObservatory(ORIGIN_ARRIVAL.x, ORIGIN_ARRIVAL.z)).toBe(true);
  });
});
