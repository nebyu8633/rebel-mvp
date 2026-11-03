import { describe, expect, it } from "vitest";
import { createMatch, setInput, step, tryCast, trySwitch, activeHero, TICK } from "../arena/engine";
import { HEROES, HERO_BY_ID, ROLE_STATS } from "../arena/heroes";
import { botInput, newBotMemory } from "../arena/bot";
import { MAPS } from "../arena/maps";
import type { MatchState } from "../arena/types";

const duel = (a = ["aegis", "sage", "vita"], b = ["aegis", "sage", "vita"], mapId = "vault") =>
  createMatch({ id: "m", mode: "duel", mapId, countdown: 0, players: [{ id: "A", name: "A", kind: "human", team: 0, heroes: a }, { id: "B", name: "B", kind: "human", team: 1, heroes: b }] });
const live = (st: MatchState) => {
  step(st);
  return st;
};

describe("arena engine", () => {
  it("moves only through validated input and respects collisions/bounds", () => {
    const st = live(duel());
    const A = st.players[0];
    const x0 = A.pos.x;
    expect(setInput(st, "A", { seq: 1, mx: 50, mz: 0, ax: 10, az: 0 })).toBe(true);
    expect(A.input.mx).toBeCloseTo(1); // clamped to unit length
    for (let i = 0; i < 20; i++) step(st);
    expect(A.pos.x - x0).toBeGreaterThan(4);
    expect(A.pos.x - x0).toBeLessThan(ROLE_STATS.tank.speed * 1.05 + 0.01); // ~1s at tank speed
    expect(setInput(st, "A", { seq: 1, mx: -1, mz: 0 })).toBe(false); // replayed seq ignored
    for (let i = 0; i < 400; i++) {
      setInput(st, "A", { seq: 10 + i, mx: 0, mz: 1, ax: 0, az: 20 });
      step(st);
    }
    expect(A.pos.z).toBeLessThanOrEqual(13); // inside the 26m arena
  });
  it("casts are validated: cooldown, energy, cast lock", () => {
    const st = live(duel());
    const A = st.players[0];
    expect(tryCast(st, A, "special")).toBe(null);
    expect(tryCast(st, A, "basic")).toBe("casting");
    for (let i = 0; i < 10; i++) step(st);
    expect(tryCast(st, A, "special")).toBe("cooldown");
    activeHero(A).energy = 5;
    activeHero(A).cds.defense = 0;
    expect(tryCast(st, A, "defense")).toBe("energy");
  });
  it("switching: cooldown, locked during cast animations, inactive heroes keep their state", () => {
    const st = live(duel());
    const A = st.players[0];
    activeHero(A).hp = 300;
    expect(trySwitch(st, A, 1)).toBe(null);
    expect(A.active).toBe(1);
    expect(trySwitch(st, A, 0)).toBe("cooldown");
    for (let i = 0; i < 60; i++) step(st);
    expect(A.heroes[0].hp).toBeGreaterThan(300); // bench recovery
    expect(A.heroes[0].hp).toBeLessThan(A.heroes[0].maxHp);
    // ultimate has a cast animation → no switch during it
    activeHero(A).cds.ultimate = 0;
    activeHero(A).energy = 100;
    expect(tryCast(st, A, "ultimate")).toBe(null);
    expect(trySwitch(st, A, 2)).toBe("casting");
  });
  it("damage → knock out → next hero comes in → all three down ends a duel", () => {
    const st = live(duel());
    const [A, B] = st.players;
    B.pos = { x: A.pos.x + 2, z: A.pos.z };
    A.facing = Math.atan2(2, 0);
    for (let k = 0; k < 3; k++) {
      activeHero(B).hp = 1;
      activeHero(A).cds.basic = 0;
      A.castLock = 0;
      B.pos = { x: A.pos.x + 1.5, z: A.pos.z };
      expect(tryCast(st, A, "basic")).toBe(null);
      for (let i = 0; i < 12; i++) step(st);
    }
    expect(B.heroes.every((h) => !h.alive)).toBe(true);
    expect(st.phase).toBe("ended");
    expect(st.winner?.team).toBe(0);
  });
  it("every hero has 4 abilities and role-normalized stats (rarity gives no raw power)", () => {
    for (const h of HEROES) {
      expect(Object.keys(h.abilities).sort()).toEqual(["basic", "defense", "special", "ultimate"]);
      expect(h.abilities.ultimate.cost).toBeGreaterThanOrEqual(60);
    }
    // per-role ability budgets of legendary heroes are not above commons
    const budget = (id: string) => {
      const a = HERO_BY_ID[id].abilities;
      const dmg = (e: { payload?: { damage?: number } }) => e.payload?.damage ?? 0;
      return Object.values(a).reduce((s, ab) => s + ab.effects.reduce((x, e) => x + dmg(e as never) * ("count" in e && e.count ? e.count : 1), 0) / Math.max(0.5, ab.cd), 0);
    };
    const commons = HEROES.filter((h) => h.rarity === "common");
    for (const l of HEROES.filter((h) => h.rarity === "legendary")) {
      const sameRole = commons.filter((c) => c.role === l.role).map((c) => budget(c.id));
      if (sameRole.length) expect(budget(l.id)).toBeLessThanOrEqual(Math.max(...sameRole) * 1.2);
    }
  });
});

function simulate(a: string[], b: string[], mapId: string, seed: number) {
  const st = createMatch({ id: "s", mode: "duel", mapId, countdown: 0, seed, players: [{ id: "A", name: "A", kind: "bot", team: 0, heroes: a }, { id: "B", name: "B", kind: "bot", team: 1, heroes: b }] });
  const mem = [newBotMemory(), newBotMemory()];
  for (let i = 0; i < 200 / TICK && st.phase !== "ended"; i++) {
    st.players.forEach((p, k) => setInput(st, p.id, botInput(st, p, mem[k], "normal", TICK)));
    step(st);
  }
  return st.winner?.team;
}

describe("balance (bot vs bot simulation)", () => {
  it("an all-legendary team does not automatically beat an all-common team", { timeout: 60000 }, () => {
    const common = ["aegis", "sage", "vita"]; // tank, damage, support
    const legendary = ["oracle", "phoenix", "croesus"]; // tank, damage, support
    let legWins = 0;
    let games = 0;
    for (const m of MAPS)
      for (let s = 1; s <= 6; s++) {
        const w1 = simulate(legendary, common, m.id, s);
        const w2 = simulate(common, legendary, m.id, s + 100);
        if (w1 === 0) legWins++;
        if (w2 === 1) legWins++;
        games += 2;
      }
    const rate = legWins / games;
    console.log("legendary win rate vs common:", rate.toFixed(2), "games", games);
    expect(rate).toBeGreaterThan(0.25);
    expect(rate).toBeLessThan(0.75);
  });
  it("no single hero dominates or is useless (each within 20–80% vs a reference team)", { timeout: 120000 }, () => {
    const ref = ["aegis", "sage", "vita"];
    for (const h of HEROES) {
      const team = h.role === "tank" ? [h.id, "sage", "vita"] : h.role === "damage" ? ["aegis", h.id, "vita"] : ["aegis", "sage", h.id];
      let w = 0;
      let n = 0;
      for (const m of MAPS)
        for (let s = 1; s <= 4; s++) {
          if (simulate(team, ref, m.id, s) === 0) w++;
          if (simulate(ref, team, m.id, s + 77) === 1) w++;
          n += 2;
        }
      expect(w / n, h.id).toBeGreaterThanOrEqual(0.2);
      expect(w / n, h.id).toBeLessThanOrEqual(0.8);
    }
  });
  it("matches finish (no stalemates without a result) and every match has a winner or draw", { timeout: 60000 }, () => {
    for (let s = 1; s <= 10; s++) {
      const st = createMatch({ id: "x", mode: "duel", mapId: MAPS[s % MAPS.length].id, countdown: 0, players: [{ id: "A", name: "A", kind: "bot", team: 0, heroes: ["titan", "lira", "harmony"] }, { id: "B", name: "B", kind: "bot", team: 1, heroes: ["forge", "zen", "mirage"] }] });
      const mem = [newBotMemory(), newBotMemory()];
      for (let i = 0; i < 200 / TICK && st.phase !== "ended"; i++) {
        st.players.forEach((p, k) => setInput(st, p.id, botInput(st, p, mem[k], "normal", TICK)));
        step(st);
      }
      expect(st.phase).toBe("ended");
    }
  });
});
