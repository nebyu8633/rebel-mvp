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
