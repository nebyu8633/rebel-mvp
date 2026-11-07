import { describe, it, expect } from "vitest";
import { apply, applyAll, check, initialWorldState, type WorldState } from "../aetheria/core/state";
import { questStatus, validateQuest } from "../aetheria/core/quests";
import { choose, enterActions, validateDialogue, viewNode, type DialogueDef } from "../aetheria/core/dialogue";
import { decide, APPROACH_R } from "../aetheria/echo/behavior";
import * as C from "../aetheria/content/firstResonance";
import { ECHO_AWAKENING, FIRST_TOUCH, ECHO_TALK, E, MEM, echoDialogueFor, echoWaits } from "../aetheria/content/echoAwakening";
import { QUESTS, JOURNAL, currentQuest } from "../aetheria/content/index";
import { FORCES } from "../aetheria/core/model";
import { parseSave, newSave } from "../save/saveStore";

const run = (s: WorldState, a: Parameters<typeof applyAll>[1]) => {
  const r = applyAll(s, a);
  expect(r.ok).toBe(true);
  return r.state;
};

/** Finish The First Resonance without any real-life input. */
function afterFirstResonance(): WorldState {
  let s = initialWorldState();
  s = run(s, C.onArrive());
  s = run(s, C.onObservatory());
  s = run(s, C.onTouchFragment(s));
  for (const f of FORCES) s = run(s, C.onAlign(f));
  s = run(s, C.onResonanceComplete());
  s = run(s, C.onTerrace());
  s = run(s, C.onReadSigils());
  return s;
}

/** Walk a dialogue the way the runner does: enter actions on each node, then the picked choice. */
function walk(def: DialogueDef, s: WorldState, picks: string[]): { s: WorldState; seen: string[] } {
  let node: string | null = def.start;
  const seen: string[] = [];
  const queue = [...picks];
  while (node) {
    s = run(s, enterActions(def, node));
    const v = viewNode(def, node, s)!;
    seen.push(v.text);
    const r = choose(def, node, v.choices.length ? queue.shift()! : null, s);
    if (!r.ok) throw new Error(r.reason);
    s = run(s, r.actions);
    node = r.next;
  }
  return { s, seen };
}

describe("narrative memory", () => {
  it("remember / count are validated by the engine", () => {
    let s = initialWorldState();
    s = run(s, [{ type: "remember", key: "echo.bond", value: "form" }, { type: "count", key: "echo.visits" }, { type: "count", key: "echo.visits", by: 2 }]);
    expect(s.memory).toEqual({ "echo.bond": "form", "echo.visits": 3 });
    expect(apply(s, { type: "remember", key: "hack", value: 1 }).ok).toBe(false); // bad namespace
    expect(apply(s, { type: "remember", key: "echo.x", value: "x".repeat(65) }).ok).toBe(false);
    expect(apply(s, { type: "count", key: "echo.bond" }).ok).toBe(false); // not a counter
    expect(apply(s, { type: "count", key: "echo.visits", by: 0 }).ok).toBe(false);
    expect(apply(s, { type: "count", key: "echo.visits", by: 1000 }).ok).toBe(false);
  });

  it("memory conditions and echoIs", () => {
    const s = run(initialWorldState(), [{ type: "remember", key: "echo.bond", value: "change" }, { type: "count", key: "echo.visits", by: 3 }]);
    expect(check(s, { memory: "echo.bond", equals: "change" })).toBe(true);
    expect(check(s, { memory: "echo.bond", equals: "form" })).toBe(false);
    expect(check(s, { memory: "echo.visits", atLeast: 3 })).toBe(true);
    expect(check(s, { memory: "echo.visits", atLeast: 4 })).toBe(false);
    expect(check(s, { memory: "echo.missing" })).toBe(false);
    expect(check(s, { echoIs: "dormant" })).toBe(true);
  });

  it("old saves without memory still load", () => {
    const old = newSave() as unknown as { world: Record<string, unknown> };
    delete old.world.memory;
    const r = parseSave(JSON.parse(JSON.stringify(old)));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.world.memory).toEqual({});
  });
});

describe("dialogue engine", () => {
  it("all Echo dialogues and quests are valid", () => {
    expect(validateDialogue(FIRST_TOUCH)).toEqual([]);
    expect(validateDialogue(ECHO_TALK)).toEqual([]);
    for (const q of QUESTS) expect(validateQuest(q)).toEqual([]);
    for (const j of ["j.fragmented", "j.bond"]) expect(JOURNAL[j]?.body.length).toBeGreaterThan(20);
  });

  it("validator catches broken dialogues", () => {
    const bad: DialogueDef = {
      id: "bad",
      start: "nope",
      essential: true,
      nodes: {
        a: { speaker: "echo", lines: [{ text: "x", when: { flag: "f" } }], choices: [{ id: "c", text: "c", when: { flag: "life:x" }, next: "zzz" }] },
      },
    };
    const errs = validateDialogue(bad).join("\n");
    expect(errs).toMatch(/missing start/);
    expect(errs).toMatch(/last line must be unconditional/);
    expect(errs).toMatch(/unknown next zzz/);
    expect(errs).toMatch(/all choices are conditional/);
    expect(errs).toMatch(/real-life flags/);
  });

  it("choose rejects unknown choices and requires a choice when one exists", () => {
    const s = initialWorldState();
    expect(choose(FIRST_TOUCH, "start", "fly", s).ok).toBe(false);
    expect(choose(FIRST_TOUCH, "start", null, s).ok).toBe(false);
    expect(choose(FIRST_TOUCH, "shatter", null, s)).toMatchObject({ ok: true, next: "first_words" });
  });
});

describe("Voices from the Fragment — story", () => {
  it("Echo offers nothing before the kingdoms are revealed", () => {
    expect(echoDialogueFor(initialWorldState())).toBeNull();
    expect(questStatus(ECHO_AWAKENING, initialWorldState()).state).not.toBe("active");
  });

  it("is completable with NO real-life activity, and memory changes the conversation", () => {
    let s = afterFirstResonance();
    expect(echoWaits(s)).toBe(true);
    expect(currentQuest(s).id).toBe("echo_awakening");
    expect(echoDialogueFor(s)).toBeNull(); // must approach first
    s = run(s, [{ type: "setFlag", flag: E.approached }]);
    expect(echoDialogueFor(s)).toBe(FIRST_TOUCH);

    const r = walk(FIRST_TOUCH, s, ["wait", "touch", "who", "connection"]);
    s = r.s;
    expect(s.echo).toBe("fragmented_mind");
    expect(echoWaits(s)).toBe(false);
    expect(s.memory[MEM.bond]).toBe("connection");
    expect(r.seen.some((t) => t.includes("חיבור… כן"))).toBe(true);
    expect(questStatus(ECHO_AWAKENING, s).state).toBe("complete");
    expect(s.flags.some((f) => f.startsWith("life:"))).toBe(false);
    expect(s.journal.map((j) => j.id)).toEqual(expect.arrayContaining(["j.fragmented", "j.bond"]));

    // afterwards: the repeatable talk, flavoured by the bond, then by visits
    expect(echoDialogueFor(s)).toBe(ECHO_TALK);
    const t1 = walk(ECHO_TALK, s, ["kingdoms", "next", "bye"]);
    expect(t1.seen[0]).toContain("חיבור");
    expect(t1.s.memory[MEM.talks]).toBe(1);
    const visited = run(t1.s, [{ type: "count", key: MEM.visits, by: 3 }]);
    expect(viewNode(ECHO_TALK, "start", visited)!.text).toContain("לזכור את הצעדים");
    const withLife = { ...visited, flags: [...visited.flags, "life:memory.health_shard"] }; // only the enrichment path may set life: flags
    expect(apply(visited, { type: "setFlag", flag: "life:memory.health_shard" }).ok).toBe(false);
    expect(viewNode(ECHO_TALK, "start", withLife)!.text).toContain("מהעולם השני");
  });

  it("each bond gives its own farewell line", () => {
    const base = run(afterFirstResonance(), [{ type: "setFlag", flag: E.approached }]);
    const lines = (["form", "change", "connection"] as const).map((b) => walk(FIRST_TOUCH, base, ["touch", "broken", b]).seen.at(-2));
    expect(new Set(lines).size).toBe(3);
  });

  it("the touch cannot evolve the Echo twice", () => {
    let s = run(afterFirstResonance(), [{ type: "setFlag", flag: E.approached }]);
    s = walk(FIRST_TOUCH, s, ["touch", "who", "form"]).s;
    const again = apply(s, { type: "advanceEcho", to: "fragmented_mind" });
    expect(again.ok && again.changed).toBe(false);
  });
});

describe("Echo behaviour", () => {
  const base = { dist: 10, sameLevel: true, waiting: false, inDialogue: false, event: null } as const;
  it("dormant is hidden", () => expect(decide({ ...base, stage: "dormant" }).mode).toBe("hidden"));
  it("Silent Observer withdraws when approached, unless the story makes it wait", () => {
    expect(decide({ ...base, stage: "silent_observer" }).mode).toBe("observe");
    expect(decide({ ...base, stage: "silent_observer", dist: APPROACH_R - 0.5 }).mode).toBe("withdraw");
    expect(decide({ ...base, stage: "silent_observer", dist: APPROACH_R - 0.5, sameLevel: false }).mode).toBe("observe");
    expect(decide({ ...base, stage: "silent_observer", dist: 1, waiting: true }).mode).toBe("wait");
  });
  it("reactions differ by stage", () => {
    expect(decide({ ...base, stage: "silent_observer", event: "wave" }).reaction).toBe("tilt");
    expect(decide({ ...base, stage: "fragmented_mind", event: "wave" }).reaction).toBe("wave");
    expect(decide({ ...base, stage: "fragmented_mind", event: "wave", dist: 50 }).reaction).toBe("none");
    expect(decide({ ...base, stage: "silent_observer", event: "resonance", dist: 50 }).reaction).toBe("look_up");
    expect(decide({ ...base, stage: "silent_observer", event: "jump" }).reaction).toBe("none");
    expect(decide({ ...base, stage: "fragmented_mind", inDialogue: true, event: "wave" })).toEqual({ mode: "converse", reaction: "none", attention: 1 });
  });
});
