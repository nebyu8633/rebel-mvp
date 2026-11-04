import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { CharacterAnimationController, type AnimInput } from "../character/animationController";
import { sampleRoot, type CharacterMeta } from "../character/clipMeta";
import { FacialController } from "../character/facial";
import { MIXAMO_TO_ROCKETBOX, renameTracks, mapCoverage } from "../character/retarget";
import { LifeEventSink, MockLifeEventSource } from "../progression/lifeEvents";

const meta: CharacterMeta = JSON.parse(readFileSync(new URL("../../public/assets/character/character.meta.json", import.meta.url), "utf8"));
const base: AnimInput = { dt: 1 / 60, speed: 0, inputMag: 0, grounded: true, vy: 0, turnAngle: 0 };
const run = (c: CharacterAnimationController, frames: number, i: Partial<AnimInput>) => {
  let f = c.update({ ...base, ...i });
  for (let k = 1; k < frames; k++) f = c.update({ ...base, ...i });
  return f;
};
const sumW = (f: ReturnType<CharacterAnimationController["update"]>) => Object.values(f.clips).reduce((s, c) => s + c.weight, 0);

describe("clip metadata (from the asset build)", () => {
  it("has measured locomotion speeds and root curves", () => {
    expect(meta.clips.walk.speed).toBeGreaterThan(0.8);
    expect(meta.clips.run.speed).toBeGreaterThan(2.3);
    expect(meta.clips.walk_stop.root!.length).toBeGreaterThan(5);
    expect(Math.abs(meta.clips.turn_left_90.rootTotal!.yaw - Math.PI / 2)).toBeLessThan(0.05);
    expect(meta.clips.jump_air.placeholder).toBe(true);
  });
  it("sampleRoot interpolates and clamps", () => {
    const r: [number, number, number, number][] = [[0, 0, 0, 0], [1, 1, 2, 0.5]];
    expect(sampleRoot(r, 0.5)).toEqual([0.5, 1, 0.25]);
    expect(sampleRoot(r, 5)).toEqual([1, 2, 0.5]);
    expect(sampleRoot(r, -1)).toEqual([0, 0, 0]);
  });
});

describe("CharacterAnimationController", () => {
  it("starts idle and keeps weights normalised", () => {
    const c = new CharacterAnimationController(meta);
    const f = run(c, 5, {});
    expect(f.state).toBe("idle");
    expect(sumW(f)).toBeCloseTo(1, 5);
  });
  it("crossfades idle -> walk -> run by measured speed", () => {
    const c = new CharacterAnimationController(meta);
    let f = run(c, 60, { speed: meta.clips.walk.speed, inputMag: 0.5 });
    expect(f.state).toBe("locomotion");
    expect(f.clips.walk.weight).toBeGreaterThan(0.95);
    f = run(c, 60, { speed: meta.clips.run.speed, inputMag: 1 });
    expect(f.clips.run.weight).toBeGreaterThan(0.95);
    expect(sumW(f)).toBeCloseTo(1, 5);
  });
  it("cycle rate matches ground speed (no foot sliding): stride * rate == speed", () => {
    const c = new CharacterAnimationController(meta);
    for (const s of [0.8, 1.0, 1.6, 2.2, 2.9, 3.4]) {
      const b = c.locomotionBlend(s);
      const a = b.run / (b.walk + b.run || 1);
      const stride = c.walk.stride + (c.run.stride - c.walk.stride) * a;
      expect(stride * b.rate).toBeCloseTo(s, 5);
    }
  });
  it("walk and run share one normalised phase", () => {
    const c = new CharacterAnimationController(meta);
    const f = run(c, 50, { speed: 1.9, inputMag: 0.8 });
    expect(f.clips.walk.time / meta.clips.walk.duration).toBeCloseTo(f.clips.run.time / meta.clips.run.duration, 5);
  });
  it("releasing input while walking plays a root-motion stop and locks movement", () => {
    const c = new CharacterAnimationController(meta);
    run(c, 60, { speed: 1.2, inputMag: 0.6 });
    let f = c.update({ ...base, speed: 1.2, inputMag: 0 });
    expect(f.state).toBe("stop");
    let dist = 0;
    for (let k = 0; k < 200 && f.state === "stop"; k++) {
      f = c.update({ ...base, speed: 0.6, inputMag: 0 });
      expect(f.lockMovement || f.state !== "stop").toBe(true);
      if (f.root) dist += f.root.dz;
    }
    expect(f.state).toBe("idle");
    expect(dist).toBeGreaterThan(0.5); // forward root motion consumed by movement
  });
  it("input during a stop cancels back into locomotion", () => {
    const c = new CharacterAnimationController(meta);
    run(c, 60, { speed: 1.2, inputMag: 0.6 });
    run(c, 5, { speed: 1, inputMag: 0 });
    expect(c.update({ ...base, speed: 1, inputMag: 0.8 }).state).toBe("locomotion");
  });
  it("big direction change from idle turns in place with exact total yaw", () => {
    const c = new CharacterAnimationController(meta);
    run(c, 10, {});
    let yaw = 0;
    let f = c.update({ ...base, inputMag: 1, turnAngle: Math.PI / 2 });
    expect(f.state).toBe("turn");
    if (f.root) yaw += f.root.dyaw;
    for (let k = 0; k < 400 && f.state === "turn"; k++) {
      f = c.update({ ...base, inputMag: 1, turnAngle: Math.PI / 2 - yaw });
      expect(f.lockMovement || f.state !== "turn").toBe(true);
      if (f.root) yaw += f.root.dyaw;
    }
    expect(yaw).toBeCloseTo(Math.PI / 2, 2);
    expect(f.state).toBe("locomotion");
  });
  it("turn scales to the requested angle (right, 120°)", () => {
    const c = new CharacterAnimationController(meta);
    const want = (-120 * Math.PI) / 180;
    let yaw = 0;
    let f = c.update({ ...base, inputMag: 1, turnAngle: want });
    for (let k = 0; k < 400 && f.state === "turn"; k++) {
      if (f.root) yaw += f.root.dyaw;
      f = c.update({ ...base, inputMag: 1, turnAngle: want - yaw });
    }
    if (f.root) yaw += f.root.dyaw;
    expect(yaw).toBeCloseTo(want, 2);
  });
  it("airborne -> air pose, landing emits land and returns to locomotion", () => {
    const c = new CharacterAnimationController(meta);
    run(c, 30, { speed: 1, inputMag: 0.5 });
    let f = c.update({ ...base, grounded: false, vy: 5, speed: 1, inputMag: 0.5 });
    expect(f.state).toBe("air");
    expect(f.events).toContain("jump");
    f = run(c, 20, { grounded: false, vy: -2, speed: 1, inputMag: 0.5 });
    expect(f.clips.jump_air.weight).toBeGreaterThan(0.9);
    f = c.update({ ...base, speed: 1, inputMag: 0.5 });
    expect(f.events).toContain("land");
    expect(f.state).toBe("locomotion");
  });
  it("short ground loss (step/edge) does not trigger the air state", () => {
    const c = new CharacterAnimationController(meta);
    run(c, 30, { speed: 1, inputMag: 0.5 });
    expect(run(c, 4, { grounded: false, vy: -0.5, speed: 1, inputMag: 0.5 }).state).toBe("locomotion");
  });
  it("interaction plays once, fires contact once, locks movement", () => {
    const c = new CharacterAnimationController(meta);
    let f = c.update({ ...base, interact: true });
    expect(f.state).toBe("interact");
    let contacts = 0;
    for (let k = 0; k < 600 && f.state === "interact"; k++) {
      f = c.update(base);
      contacts += f.events.filter((e) => e === "contact").length;
    }
    expect(contacts).toBe(1);
    expect(f.state).toBe("idle");
  });
  it("gesture can be cancelled by movement input", () => {
    const c = new CharacterAnimationController(meta);
    c.update({ ...base, gesture: true });
    run(c, 10, {});
    expect(c.update({ ...base, inputMag: 0.9, speed: 0.3 }).state).toBe("locomotion");
  });
});

describe("FacialController", () => {
  it("blinks periodically and fully closes", () => {
    const f = new FacialController(3);
    let maxBlink = 0;
    let closes = 0;
    let prev = 0;
    for (let k = 0; k < 60 * 12; k++) {
      const v = f.update(1 / 60);
      maxBlink = Math.max(maxBlink, v.eyeBlinkLeft ?? 0);
      if ((v.eyeBlinkLeft ?? 0) > 0.5 && prev <= 0.5) closes++;
      prev = v.eyeBlinkLeft ?? 0;
    }
    expect(maxBlink).toBeGreaterThan(0.95);
    expect(closes).toBeGreaterThanOrEqual(2);
    expect(closes).toBeLessThan(10);
  });
  it("expressions ease in and expire back to neutral", () => {
    const f = new FacialController();
    f.setExpression("happy", 1);
    let v = f.update(0.5);
    for (let k = 0; k < 30; k++) v = f.update(1 / 60);
    expect(v.mouthSmileLeft).toBeGreaterThan(0.5);
    for (let k = 0; k < 120; k++) v = f.update(1 / 60);
    expect(f.currentExpression).toBe("neutral");
    expect(v.mouthSmileLeft ?? 0).toBeLessThan(0.1);
  });
});

describe("retargeting", () => {
  it("maps Mixamo names (with prefix) to Rocketbox and reports unmapped bones", () => {
    const { tracks, dropped } = renameTracks([{ name: "mixamorig:Hips.quaternion" }, { name: "mixamorig:LeftFoot.quaternion" }, { name: "mixamorig:HeadTop_End.position" }], MIXAMO_TO_ROCKETBOX);
    expect(tracks.map((t) => t.name)).toEqual(["Bip01_Pelvis.quaternion", "Bip01_L_Foot.quaternion"]);
    expect(dropped).toEqual(["HeadTop_End"]);
  });
  it("covers the avatar skeleton", () => {
    const bones = Object.values(MIXAMO_TO_ROCKETBOX);
    expect(mapCoverage(MIXAMO_TO_ROCKETBOX, bones).missing).toEqual([]);
  });
});

describe("LifeOS hookup (mock only, never awards XP)", () => {
  it("accepts valid events once, rejects invalid ones", () => {
    const src = new MockLifeEventSource();
    const sink = new LifeEventSink(true);
    const got: unknown[] = [];
    src.subscribe((e) => got.push(sink.accept(e)));
    const e = src.emit("task_verified", "health");
    expect(got[0]).toMatchObject({ ok: true, reaction: { kind: "light_window", mock: true } });
    expect(sink.accept(e)).toEqual({ ok: true, reaction: null }); // idempotent
    expect(sink.accept({ ...e, eventId: "x", source: "game" }).ok).toBe(false);
    expect(sink.accept({ ...e, eventId: "y", correctsEventId: "z" }).ok).toBe(false);
  });
  it("corrections revert the visual reaction exactly once", () => {
    const src = new MockLifeEventSource();
    const sink = new LifeEventSink(true);
    const e = src.emit();
    sink.accept(e);
    const fix = src.emit("verification_corrected", e.domain, e.eventId);
    expect(sink.accept(fix)).toMatchObject({ ok: true, reaction: { kind: "revert" } });
    expect(sink.accept({ ...fix, eventId: "fix:again" })).toEqual({ ok: true, reaction: null });
  });
  it("exposes no XP API", () => {
    const sink = new LifeEventSink(true) as unknown as Record<string, unknown>;
    for (const k of ["awardXp", "addXp", "xp", "grantXp"]) expect(sink[k]).toBeUndefined();
    const r = sink.accept as (e: unknown) => { reaction: Record<string, unknown> | null };
    const out = r.call(sink, new MockLifeEventSource().emit());
    expect(Object.keys(out.reaction ?? {})).not.toContain("xp");
  });
});
