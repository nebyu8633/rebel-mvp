import { describe, it, expect, vi, beforeEach } from "vitest";
import * as THREE from "three";
import { apply, applyAll, check, initialWorldState } from "../aetheria/core/state";
import { questStatus, validateQuest, type QuestDef } from "../aetheria/core/quests";
import { applyLifeEvent, emptyLedger, grantFlag, validateRules, type EnrichmentRule } from "../aetheria/core/enrichment";
import { KINGDOM_IDS } from "../aetheria/core/model";
import { DOMAINS } from "../data/lifeos";
import { MockLifeEventSource } from "../progression/lifeEvents";
import { LocalSaveStore, MemoryKV, parseSave } from "../save/saveStore";
import { architectIdentity, defaultLoadout, equip, validateLoadout, ITEMS } from "../avatar/loadout";
import { attach, attachmentMatrix, findBone } from "../avatar/attach";
import { useWorlds } from "../engine/worldStore";

const NOW = "2026-11-07T10:00:00.000Z";

describe("AETHERIA canon", () => {
  it("the six kingdoms are exactly the six LifeOS domains", () => {
    expect([...KINGDOM_IDS].sort()).toEqual([...DOMAINS].sort());
  });
});

describe("rules engine", () => {
  it("applies valid actions, records history, is idempotent", () => {
    let s = initialWorldState();
    const r = applyAll(s, [{ type: "setFlag", flag: "sanctuary.entered" }, { type: "discover", id: "observatory" }, { type: "journal", id: "j.first_light" }], NOW);
    expect(r.ok).toBe(true);
    s = r.state;
    expect(s.flags).toEqual(["sanctuary.entered"]);
    expect(s.history.map((h) => h.action)).toEqual(["setFlag", "discover", "journal"]);
    const again = apply(s, { type: "discover", id: "observatory" }, NOW);
    expect(again.ok && again.changed).toBe(false);
  });
  it("rejects invalid proposals without changing the world", () => {
    const s = initialWorldState();
    expect(apply(s, { type: "setFlag", flag: "life:memory.x" }).ok).toBe(false); // story can't write life flags
    expect(apply(s, { type: "setFlag", flag: "story.x", source: "life" }).ok).toBe(false); // life can't write story flags
    expect(apply(s, { type: "setFlag", flag: "BAD FLAG!" }).ok).toBe(false);
    expect(apply(s, { type: "advanceEcho", to: "future_companion" }).ok).toBe(false); // no skipping stages
    const r = applyAll(s, [{ type: "discover", id: "a" }, { type: "advanceEcho", to: "fragmented_mind" }]);
    expect(r.ok).toBe(false);
    expect(r.state).toBe(s); // all-or-nothing
  });
  it("the Echo evolves forward one stage at a time", () => {
    let s = initialWorldState();
    for (const to of ["silent_observer", "fragmented_mind", "future_companion"] as const) {
      const r = apply(s, { type: "advanceEcho", to });
      expect(r.ok).toBe(true);
      s = r.state;
    }
    expect(apply(s, { type: "advanceEcho", to: "silent_observer" }).ok).toBe(false);
  });
});

describe("quests + accessibility rule", () => {
  const main: QuestDef = {
    id: "first_resonance",
    title: "The First Resonance",
    essential: true,
    steps: [
      { id: "enter", text: "Enter", done: { flag: "sanctuary.entered" } },
      { id: "fragment", text: "Touch the Fragment", done: { flag: "fragment.touched" } },
    ],
  };
  it("progresses through steps by world state", () => {
    expect(validateQuest(main)).toEqual([]);
    let s = initialWorldState();
    expect(questStatus(main, s)).toMatchObject({ state: "active", index: 0 });
    s = applyAll(s, [{ type: "setFlag", flag: "sanctuary.entered" }, { type: "setFlag", flag: "fragment.touched" }]).state;
    expect(questStatus(main, s).state).toBe("complete");
  });
  it("rejects essential content that depends on real-life activity", () => {
    const bad: QuestDef = { ...main, id: "bad", steps: [{ id: "x", text: "x", done: { any: [{ flag: "story.a" }, { not: { flag: "life:bonus.streak" } }] } }] };
    expect(validateQuest(bad).join()).toMatch(/real-life/);
    expect(validateQuest({ ...bad, essential: false })).toEqual([]);
  });
  it("conditions support all/any/not/discovered/echo", () => {
    const s = applyAll(initialWorldState(), [{ type: "discover", id: "d" }, { type: "advanceEcho", to: "silent_observer" }]).state;
    expect(check(s, { all: [{ discovered: "d" }, { echoAtLeast: "silent_observer" }, { not: { flag: "x" } }] })).toBe(true);
    expect(check(s, { echoAtLeast: "fragmented_mind" })).toBe(false);
  });
});

describe("real-life enrichment", () => {
  const rules: EnrichmentRule[] = [
    { id: "r1", when: { eventTypes: ["milestone_completed"], kingdom: "knowledge" }, grant: { kind: "memory", id: "first_library" } },
    { id: "r2", when: { eventTypes: ["task_verified"] }, grant: { kind: "world_detail", id: "lantern_glow" } },
  ];
  it("validates rules", () => {
    expect(validateRules(rules)).toEqual([]);
    expect(validateRules([{ id: "x", when: { eventTypes: ["verification_corrected"] }, grant: { kind: "memory", id: "a" } }]).length).toBe(1);
    expect(validateRules([{ id: "y", when: { eventTypes: ["task_verified"] }, grant: { kind: "gold" as never, id: "a" } }]).length).toBe(1);
  });
  it("grants an optional life flag once, and revokes it on correction", () => {
    const src = new MockLifeEventSource();
    const e = src.emit("milestone_completed", "knowledge");
    let r = applyLifeEvent(initialWorldState(), emptyLedger(), e, rules, NOW);
    expect(r.granted).toBe(grantFlag(rules[0].grant));
    expect(r.state.flags).toContain("life:memory.first_library");
    const dup = applyLifeEvent(r.state, r.ledger, e, rules, NOW);
    expect(dup.granted).toBeNull();
    const fix = src.emit("verification_corrected", null, e.eventId);
    r = applyLifeEvent(r.state, r.ledger, fix, rules, NOW);
    expect(r.revoked).toBe("life:memory.first_library");
    expect(r.state.flags).not.toContain("life:memory.first_library");
    expect(r.state.history.length).toBe(2); // history kept
  });
  it("rejects anything that isn't a valid VerifiedLifeEvent", () => {
    const r = applyLifeEvent(initialWorldState(), emptyLedger(), { eventId: "x", source: "game" }, rules);
    expect(r.rejected).toBeTruthy();
    expect(r.state.flags).toEqual([]);
  });
});

describe("save system (local)", () => {
  it("round-trips a valid save", async () => {
    const kv = new MemoryKV();
    const store = new LocalSaveStore(kv);
    const world = applyAll(initialWorldState(), [{ type: "setFlag", flag: "a" }]).state;
    const loadout = equip(defaultLoadout(), "architect_staff");
    if (!loadout.ok) throw new Error();
    await store.save({ world, loadout: loadout.loadout, enrichment: emptyLedger() });
    const back = await store.load();
    expect(back?.world.flags).toEqual(["a"]);
    expect(back?.loadout.equipped.mainHand).toBe("architect_staff");
  });
  it("keeps corrupted saves as a backup instead of overwriting silently", async () => {
    const kv = new MemoryKV();
    kv.setItem("aetheria:save:slot1", "{not json");
    expect(await new LocalSaveStore(kv).load()).toBeNull();
    expect([...kv.m.keys()].some((k) => k.startsWith("aetheria:save:slot1:backup:"))).toBe(true);
    expect(kv.getItem("aetheria:save:slot1")).toBeNull();
  });
  it("rejects unknown versions", () => {
    expect(parseSave({ version: 2 }).ok).toBe(false);
  });
});

describe("Living Architect loadout", () => {
  it("validates slots and tiers", () => {
    expect(validateLoadout(defaultLoadout())).toEqual([]);
    expect(equip(defaultLoadout(), "sentinel_pauldrons").ok).toBe(false); // tier 1 item
    expect(equip({ ...defaultLoadout(), tier: 1 }, "sentinel_pauldrons").ok).toBe(true);
    expect(validateLoadout({ base: "auto", tier: 0, equipped: { head: "architect_staff" } }).join()).toMatch(/does not fit/);
    for (const it of ITEMS) expect(it.minTier).toBeGreaterThanOrEqual(0);
  });
  it("identity comes from the LifeOS profile (read-only), with a safe default", () => {
    expect(architectIdentity(null).displayName).toBe("האדריכל החי");
    expect(architectIdentity({ displayName: "Neb", avatar: { skin: 2, outfit: 0, accent: 3, emblem: 1 } })).toMatchObject({ displayName: "Neb", emblem: 1 });
  });
  it("attachments follow the bone and ignore rig scale/axes", () => {
    // character root -> armature scaled 0.01 and rotated (like an FBX Biped) -> hand bone
    const root = new THREE.Group();
    const arm = new THREE.Object3D();
    arm.scale.setScalar(0.01);
    arm.rotation.set(-Math.PI / 2, 0, 0.3);
    const hand = new THREE.Bone();
    hand.name = "Bip01_R_Hand";
    hand.position.set(-30, 10, 85);
    arm.add(hand);
    root.add(arm);
    root.updateMatrixWorld(true);
    expect(findBone(root, "rightHand")).toBe(hand);
    const item = new THREE.Object3D();
    const handWorld = hand.getWorldPosition(new THREE.Vector3());
    attach(hand, item, attachmentMatrix(hand, root, { offset: [0, 0, 0.1] }));
    root.updateMatrixWorld(true);
    const p = item.getWorldPosition(new THREE.Vector3());
    expect(p.distanceTo(handWorld.clone().add(new THREE.Vector3(0, 0, 0.1)))).toBeLessThan(1e-6);
    const s = item.getWorldScale(new THREE.Vector3());
    expect(s.x).toBeCloseTo(1, 5); // metres in world, despite the 0.01 armature
    // the item now follows the bone
    hand.position.x += 10;
    root.updateMatrixWorld(true);
    expect(item.getWorldPosition(new THREE.Vector3()).distanceTo(p)).toBeGreaterThan(0.05);
  });
  it("finds Mixamo/Avaturn-named bones too", () => {
    const root = new THREE.Group();
    const b = new THREE.Bone();
    b.name = "mixamorigLeftHand";
    root.add(b);
    expect(findBone(root, "leftHand")).toBe(b);
  });
});

describe("world transitions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useWorlds.getState().setKnown(["city", "test"]);
    useWorlds.getState().setCurrent("city");
  });
  it("fades out, swaps, fades in; ignores unknown/busy requests", () => {
    const w = useWorlds.getState();
    expect(w.transitionTo("nowhere")).toBe(false);
    expect(w.transitionTo("city")).toBe(false);
    expect(w.transitionTo("test", { outMs: 100, inMs: 100 })).toBe(true);
    expect(useWorlds.getState()).toMatchObject({ phase: "out", current: "city", target: "test" });
    expect(useWorlds.getState().transitionTo("city")).toBe(false); // busy
    vi.advanceTimersByTime(100);
    expect(useWorlds.getState()).toMatchObject({ phase: "in", current: "test" });
    vi.advanceTimersByTime(100);
    expect(useWorlds.getState().phase).toBe("idle");
    vi.useRealTimers();
  });
});

describe("world navigation across hosts", () => {
  it("uses in-place transitions for registered worlds and the host navigator otherwise", async () => {
    const { goToWorld, worldAvailable, setWorldNavigator, useWorlds: W } = await import("../engine/worldStore");
    W.getState().setKnown(["city"]);
    W.getState().setCurrent("city");
    const went: string[] = [];
    setWorldNavigator({ has: (id) => id === "sanctuary", go: (id) => went.push(id) });
    expect(worldAvailable("sanctuary")).toBe(true);
    expect(worldAvailable("nowhere")).toBe(false);
    expect(goToWorld("sanctuary")).toBe(true);
    expect(went).toEqual(["sanctuary"]);
    expect(goToWorld("nowhere")).toBe(false);
    setWorldNavigator(null);
    expect(worldAvailable("sanctuary")).toBe(false);
  });
});
