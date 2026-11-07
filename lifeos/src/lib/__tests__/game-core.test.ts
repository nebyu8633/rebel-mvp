import { describe, expect, it } from "vitest";
import { VerifiedLifeEvent, lifeEventId, LIFE_EVENT_SCHEMA_VERSION } from "../../game-core/contracts/events";
import { splitProgress } from "../../game-core/progression/split";
import { cityLayout, hallState, resolve, HALL, FOUNTAIN, SPAWN, CITY_BOUNDS } from "../../game-core/world/city";

const ev = (p: Partial<Record<string, unknown>> = {}) => ({ eventId: "task:a", userId: "u", source: "lifeos_core", eventType: "task_verified", attestation: "self", sourceEntityId: "a", domain: "knowledge", verifiedAt: "2026-11-04T10:00:00.000Z", schemaVersion: LIFE_EVENT_SCHEMA_VERSION, ...p });

describe("VerifiedLifeEvent contract v1", () => {
  it("accepts a valid self-attested event and rejects unknown sources/versions", () => {
    expect(VerifiedLifeEvent.safeParse(ev()).success).toBe(true);
    expect(VerifiedLifeEvent.safeParse(ev({ source: "game_client" })).success).toBe(false);
    expect(VerifiedLifeEvent.safeParse(ev({ schemaVersion: 2 })).success).toBe(false);
    expect(VerifiedLifeEvent.safeParse(ev({ attestation: "trusted" })).success).toBe(false);
  });
  it("corrections must reference the corrected event, and only corrections may", () => {
    expect(VerifiedLifeEvent.safeParse(ev({ eventType: "verification_corrected", eventId: "fix:task:a" })).success).toBe(false);
    expect(VerifiedLifeEvent.safeParse(ev({ eventType: "verification_corrected", eventId: "fix:task:a", correctsEventId: "task:a" })).success).toBe(true);
    expect(VerifiedLifeEvent.safeParse(ev({ correctsEventId: "task:b" })).success).toBe(false);
  });
  it("event ids are deterministic per source entity (idempotency)", () => {
    expect(lifeEventId("task_verified", "a")).toBe(lifeEventId("task_verified", "a"));
    expect(lifeEventId("milestone_completed", "m1")).toBe("ms:m1");
    expect(lifeEventId("verification_corrected", "", "task:a")).toBe("fix:task:a");
  });
});

describe("Life XP vs World Progress (read-only split)", () => {
  it("game-origin items never count as Life XP", () => {
    const s = splitProgress([
      { id: "task:a", kind: "task", amount: 25, region: "knowledge", at: "x" },
      { id: "habit:h", kind: "habit", amount: 5, region: "health", at: "x" },
      { id: "ach:first", kind: "achievement", amount: 50, region: null, at: "x" },
      { id: "chest:m", kind: "chest", amount: 20, region: null, at: "x" },
      { id: "chal:c", kind: "challenge", amount: 15, region: null, at: "x" },
    ]);
    expect(s.lifeXp).toBe(30);
    expect(s.worldProgress).toBe(85);
    expect(s.lifeByDomain.knowledge).toBe(25);
    expect(s.lifeByDomain.health).toBe(5);
  });
});

describe("city prototype", () => {
  it("hall tier comes only from knowledge Life XP thresholds", () => {
    expect(hallState(0).tier).toBe(0);
    expect(hallState(19).tier).toBe(0);
    expect(hallState(20).tier).toBe(1);
    expect(hallState(150).tier).toBe(2);
    expect(hallState(150).fraction).toBeCloseTo(0.25);
    expect(hallState(999).next).toBeNull();
    expect(HALL.tiers.length).toBe(4);
  });
  it("layout is deterministic and the spawn and walkways are free", () => {
    const a = cityLayout();
    expect(JSON.stringify(cityLayout())).toBe(JSON.stringify(a));
    const p = resolve(SPAWN, 0.4, a.colliders);
    expect(p).toEqual({ x: SPAWN.x, z: SPAWN.z });
    // walking down the street to the plaza never gets stuck
    for (let z = SPAWN.z; z > 4; z -= 1) expect(resolve({ x: 0, z }, 0.4, a.colliders).z).toBeCloseTo(z, 5);
  });
  it("collisions push out of the fountain and keep the avatar inside the city", () => {
    const a = cityLayout();
    const p = resolve({ x: 0.5, z: 0 }, 0.4, a.colliders);
    expect(Math.hypot(p.x - FOUNTAIN.x, p.z - FOUNTAIN.z)).toBeGreaterThanOrEqual(FOUNTAIN.r + 0.4 - 1e-6);
    const q = resolve({ x: 999, z: -999 }, 0.4, a.colliders);
    expect(q.x).toBeLessThanOrEqual(CITY_BOUNDS.maxX);
    expect(q.z).toBeGreaterThanOrEqual(CITY_BOUNDS.minZ);
  });
});
