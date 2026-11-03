/**
 * Training bot — used ONLY in practice matches and always shown as "בוט אימון".
 * It sends the same kind of input a human does (no cheating: it goes through the same validation).
 */
import { HERO_BY_ID } from "./heroes";
import { activeHero, onField } from "./engine";
import type { MatchState, Player, PlayerInput, Slot } from "./types";

export type BotLevel = "easy" | "normal" | "hard";
const LEVEL = { easy: { react: 0.55, jitter: 1.6, aggression: 0.5 }, normal: { react: 0.3, jitter: 0.8, aggression: 0.75 }, hard: { react: 0.12, jitter: 0.3, aggression: 1 } };

export interface BotMemory {
  think: number;
  strafe: number;
  input: PlayerInput;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function botInput(st: MatchState, me: Player, mem: BotMemory, level: BotLevel, dt: number): PlayerInput {
  const cfg = LEVEL[level];
  mem.think -= dt;
  const seq = mem.input.seq + 1;
  if (mem.think > 0) return (mem.input = { ...mem.input, seq, cast: null, switchTo: null });
  const rand = rng(st.tick * 7919 + st.seed * 15485863 + me.id.length * 104729 + me.team);
  mem.think = cfg.react * (0.7 + rand() * 0.6);
  if (!onField(me)) return (mem.input = { ...mem.input, seq, mx: 0, mz: 0, cast: null, switchTo: null });
  const h = activeHero(me);
  const def = HERO_BY_ID[h.heroId];
  const enemies = st.players.filter((p) => p.team !== me.team && onField(p));
  const allies = st.players.filter((p) => p.team === me.team && p !== me && onField(p));
  const dist = (p: Player) => Math.hypot(p.pos.x - me.pos.x, p.pos.z - me.pos.z);
  const target = enemies.sort((a, b) => dist(a) - dist(b))[0];

  // objective: crystals when no fight nearby
  let goal = target?.pos;
  if (st.mode === "crystal") {
    const free = st.crystals.filter((c) => c.owner !== me.team).sort((a, b) => Math.hypot(a.pos.x - me.pos.x, a.pos.z - me.pos.z) - Math.hypot(b.pos.x - me.pos.x, b.pos.z - me.pos.z))[0];
    if (free && (!target || dist(target) > 9)) goal = free.pos;
  }
  let mx = 0;
  let mz = 0;
  const want = def.role === "tank" ? 1.8 : def.role === "damage" ? 7.5 : 6.5;
  if (goal) {
    const dx = goal.x - me.pos.x;
    const dz = goal.z - me.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    const towards = target && goal === target.pos ? (d > want + 0.8 ? 1 : d < want - 1.2 ? -1 : 0) : 1;
    mem.strafe = rand() < 0.15 ? -mem.strafe || 1 : mem.strafe || 1;
    mx = (dx / d) * towards + (-dz / d) * 0.6 * mem.strafe * (towards === 0 ? 1 : 0.4);
    mz = (dz / d) * towards + (dx / d) * 0.6 * mem.strafe * (towards === 0 ? 1 : 0.4);
    const l = Math.hypot(mx, mz) || 1;
    mx /= l;
    mz /= l;
  }
  // support stays near a wounded ally
  if (def.role === "support" && allies.length) {
    const hurt = allies.sort((a, b) => activeHero(a).hp / activeHero(a).maxHp - activeHero(b).hp / activeHero(b).maxHp)[0];
    const d = Math.hypot(hurt.pos.x - me.pos.x, hurt.pos.z - me.pos.z);
    if (d > 5) {
      mx = (hurt.pos.x - me.pos.x) / d;
      mz = (hurt.pos.z - me.pos.z) / d;
    }
  }
  const ax = (target?.pos.x ?? me.pos.x + Math.sin(me.facing)) + (rand() - 0.5) * cfg.jitter;
  const az = (target?.pos.z ?? me.pos.z + Math.cos(me.facing)) + (rand() - 0.5) * cfg.jitter;

  // abilities
  let cast: Slot | null = null;
  const hpf = h.hp / h.maxHp;
  const ready = (s: Slot) => h.cds[s] <= 0 && h.energy >= def.abilities[s].cost;
  const td = target ? dist(target) : 99;
  if (hpf < 0.45 && ready("defense")) cast = "defense";
  else if (target && ready("ultimate") && td < Math.max(5, def.abilities.ultimate.range * 0.8) && rand() < cfg.aggression) cast = "ultimate";
  else if (target && ready("special") && td < Math.max(4, def.abilities.special.range) && rand() < cfg.aggression) cast = "special";
  else if (target && td < Math.max(2.8, def.abilities.basic.range * 0.95)) cast = "basic";

  // switch out when hurt, if a healthier hero is waiting
  let switchTo: number | null = null;
  if (hpf < 0.3 && me.switchCd <= 0) {
    const best = me.heroes.map((x, i) => ({ i, f: x.alive ? x.hp / x.maxHp : 0 })).filter((x) => x.i !== me.active && x.f > 0.6).sort((a, b) => b.f - a.f)[0];
    if (best) switchTo = best.i;
  }
  mem.input = { seq, mx, mz, ax, az, cast, switchTo };
  return mem.input;
}

export const newBotMemory = (): BotMemory => ({ think: 0, strafe: 1, input: { seq: 0, mx: 0, mz: 0, ax: 0, az: 0, cast: null, switchTo: null } });
