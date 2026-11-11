/**
 * Layout contract: the gameplay coordinates of The First Sanctuary. Visual rebuilds (new models,
 * monumental scale) must keep these — or change them here on purpose, together with the story
 * triggers and colliders that depend on them.
 */
import { describe, it, expect } from "vitest";
import * as L from "../aetheria/scenes/sanctuary/layout";

describe("First Sanctuary layout contract", () => {
  it("keeps the gameplay coordinates", () => {
    expect(L.SPAWN).toEqual({ x: 0, y: 0, z: 34, yaw: Math.PI });
    expect(L.BOUND_R).toBe(40);
    expect(L.OBS).toEqual({ x: 0, z: -6, floorR: 7.2, wallR: 7.65, wallT: 0.8, wallH: 7.5, doorBearing: 180, doorHalfDeg: 12 });
    expect(L.FLOOR_Y).toBe(0.3);
    expect(L.GALLERY).toEqual({ y: 4.2, rIn: 5.6, rOut: 7.25, from: -75, to: 110, thick: 0.25 });
    expect(L.STAIR).toEqual({ x: -5.9, z0: 3.0, z1: -1.65, width: 1.25, steps: 13, rise: 0.3, broken: [4, 5, 6, 7, 8, 9] });
    expect(L.CONSOLES.map((c) => [c.force, c.bearing, c.r])).toEqual([["form", 0, 3.9], ["change", 120, 3.9], ["connection", -120, 3.9]]);
    expect(L.SIGIL_WALL).toEqual({ bearing: 0, r: 6.9 });
    expect(L.WAYSTONE).toEqual({ x: 3.5, z: 30 });
    expect(L.GATE).toEqual({ x: -25, z: -8, half: 3.2, h: 1.5, pillarX: -26.4, pillarZ: 2.3, pillarH: 4.2, steps: 5, stepRun: 0.55 });
  });
  it("the stair reaches the gallery and every step is climbable", () => {
    expect(L.stepAt(L.STAIR.steps - 1).topY).toBeCloseTo(L.GALLERY.y);
    expect(L.STAIR.rise).toBeLessThanOrEqual(0.32);
  });
});
