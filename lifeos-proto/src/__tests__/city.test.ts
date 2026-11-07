import { describe, it, expect } from "vitest";
import { DISTRICTS, locate, gatePos, developmentStage, STAGES, SPAWN, TOWER, dirOf } from "../city/layout";
import { mockSnapshot, MockLifeOSAdapter } from "../data/mock";
import { DOMAINS, domainProgress, nextGoal, overallProgress } from "../data/lifeos";

describe("city layout", () => {
  it("has exactly the six existing LifeOS regions, once each", () => {
    expect(DISTRICTS.map((d) => d.id).sort()).toEqual([...DOMAINS].sort());
  });
  it("avenues are spread out and none points at the tower (north) or the spawn side (south)", () => {
    const b = DISTRICTS.map((d) => d.bearing).sort((a, c) => a - c);
    for (let i = 0; i < b.length; i++) {
      const gap = (b[(i + 1) % b.length] - b[i] + 360) % 360;
      expect(gap).toBeGreaterThanOrEqual(40);
    }
    for (const d of DISTRICTS) {
      expect(Math.abs(d.bearing)).toBeGreaterThan(20);
      expect(Math.abs(Math.abs(d.bearing) - 180)).toBeGreaterThan(20);
    }
  });
  it("locates plaza, tower forecourt and each avenue", () => {
    expect(locate(SPAWN.x, SPAWN.z).kind).toBe("plaza");
    expect(locate(TOWER.x, TOWER.z + TOWER.d / 2 + 3).kind).toBe("tower");
    for (const d of DISTRICTS) {
      const g = gatePos(d);
      const l = locate(g.x * 0.95, g.z * 0.95);
      expect(l.kind === "avenue" ? l.district.id : l.kind).toBe(d.id);
    }
  });
  it("gate yaw points outward along its avenue", () => {
    for (const d of DISTRICTS) {
      const g = gatePos(d);
      const v = dirOf(d.bearing);
      expect(Math.sin(g.yaw)).toBeCloseTo(v.x, 5);
      expect(Math.cos(g.yaw)).toBeCloseTo(v.z, 5);
    }
  });
});

describe("mock LifeOS data (read-only view)", () => {
  it("derives domain progress and the next goal deterministically", async () => {
    const s = await new MockLifeOSAdapter().load();
    expect(s.source).toBe("mock");
    expect(s.domainProgress).toEqual(domainProgress(s.goals));
    expect(overallProgress(s.domainProgress)).toBeGreaterThan(0);
    const n = nextGoal(s.goals)!;
    expect(s.goals.filter((g) => g.status === "active" && g.progress < 1).every((g) => g.targetDate >= n.targetDate)).toBe(true);
  });
  it("development stages are monotonic and cover 0..1 (visual only, never a lock)", () => {
    expect(developmentStage(0).level).toBe(0);
    expect(developmentStage(1).level).toBe(STAGES.length - 1);
    let prev = -1;
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const l = developmentStage(p).level;
      expect(l).toBeGreaterThanOrEqual(prev);
      prev = l;
    }
    const s = mockSnapshot();
    expect(new Set(DISTRICTS.map((d) => developmentStage(s.domainProgress[d.id]).level)).size).toBeGreaterThan(1);
  });
  it("keeps World Progress separate from Life XP", () => {
    const s = mockSnapshot();
    expect(Object.keys(s.world)).not.toContain("lifeXp");
    expect(Object.keys(s.world)).not.toContain("xp");
  });
});

describe("data providers", () => {
  it("defaults to demo and only goes live when explicitly enabled", async () => {
    const { selectProvider } = await import("../data/providers");
    const live = { kind: "lifeos" as const, load: async () => mockSnapshot() };
    expect(selectProvider({ liveEnabled: false, live }).kind).toBe("mock");
    expect(selectProvider({ liveEnabled: true, live: null }).kind).toBe("mock");
    expect(selectProvider({ liveEnabled: true, live }).kind).toBe("lifeos");
  });
});
