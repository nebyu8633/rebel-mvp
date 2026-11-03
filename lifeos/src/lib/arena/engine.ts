/**
 * Arena simulation — the single source of truth for combat. Deterministic given the same inputs,
 * fixed time step. The game server runs it authoritatively; the browser runs the very same code
 * for practice matches and for predicting the local hero's movement.
 *
 * Every cast is validated here (cooldown, energy, cast lock, stun/silence, range clamp), so a
 * client can only *ask* to move/cast/switch — it can't set positions, damage or results.
 */
import { BENCH_HEAL, ENERGY_REGEN, ENERGY_REGEN_BENCH, HERO_BY_ID, MAX_ENERGY, ROLE_STATS, SWITCH_CD } from "./heroes";
import { MAP_BY_ID, MODE_BY_ID, type MapDef, type Obstacle } from "./maps";
import type { Ability, Effect, FxEvent, HeroState, MatchState, ModeId, Payload, Player, PlayerInput, Slot, StatusType, Target, Vec } from "./types";
import { SLOTS } from "./types";

export const TICK = 1 / 20;
const PICKUP_RESPAWN = 20;
const CAPTURE_TIME = 3; // seconds to capture a crystal from neutral

export interface PlayerSetup {
  id: string;
  name: string;
  kind: "human" | "bot";
  team: number;
  heroes: string[];
}

export const emptyInput = (): PlayerInput => ({ seq: 0, mx: 0, mz: 0, ax: 0, az: 1, cast: null, switchTo: null });

function heroState(heroId: string): HeroState {
  const def = HERO_BY_ID[heroId];
  const hp = ROLE_STATS[def.role].hp;
  return { heroId, hp, maxHp: hp, energy: 60, shield: 0, shieldT: 0, cds: { basic: 0, special: 0, defense: 0, ultimate: 8 }, statuses: [], alive: true };
}

export function spawnPoint(map: MapDef, mode: ModeId, p: Pick<Player, "team">, index: number, count: number): Vec {
  if (MODE_BY_ID[mode].teams === 2 || mode === "duel") {
    const side = p.team === 0 ? -1 : 1;
    const lane = (index % 3) - 1;
    return { x: side * (map.w / 2 - 3), z: lane * 3.5 };
  }
  const a = (index / Math.max(1, count)) * Math.PI * 2;
  return { x: Math.cos(a) * (map.w / 2 - 3), z: Math.sin(a) * (map.h / 2 - 3) };
}

export function createMatch(o: { id: string; mode: ModeId; mapId: string; players: PlayerSetup[]; seed?: number; timeLimit?: number; countdown?: number }): MatchState {
  const map = MAP_BY_ID[o.mapId];
  const mode = MODE_BY_ID[o.mode];
  const teamCount = mode.teams === 2 ? 2 : o.players.length;
  const perTeamIndex: Record<number, number> = {};
  const players: Player[] = o.players.map((s, i) => {
    const team = mode.teams === 2 ? s.team : i;
    const idx = (perTeamIndex[team] = (perTeamIndex[team] ?? -1) + 1);
    const pos = spawnPoint(map, o.mode, { team }, mode.teams === 2 ? idx : i, o.players.length);
    return {
      id: s.id,
      name: s.name,
      kind: s.kind,
      team,
      heroes: s.heroes.slice(0, 3).map(heroState),
      active: 0,
      pos,
      facing: Math.atan2(-pos.x, -pos.z),
      vel: { x: 0, z: 0 },
      switchCd: 0,
      castLock: 0,
      castSlot: null,
      respawn: 0,
      eliminated: false,
      connected: true,
      input: emptyInput(),
      lastSeq: 0,
      stats: { damage: 0, healing: 0, kos: 0, downs: 0 },
      hitFlash: 0,
      switchFx: 0,
    };
  });
  return {
    id: o.id,
    mode: o.mode,
    mapId: o.mapId,
    tick: 0,
    time: 0,
    timeLimit: o.timeLimit ?? mode.timeLimit,
    phase: "countdown",
    countdown: o.countdown ?? 3,
    players,
    projectiles: [],
    zones: [],
    walls: [],
    crystals: o.mode === "crystal" ? map.crystals.map((c, i) => ({ id: i, pos: { ...c }, radius: 2.6, owner: null, progress: 0 })) : [],
    pickups: map.pickups.map((pk, i) => ({ id: i, kind: pk.kind, pos: { x: pk.x, z: pk.z }, ready: 0 })),
    score: Array.from({ length: teamCount }, () => 0),
    events: [],
    winner: null,
    nextId: 1,
    seed: o.seed ?? 1,
  };
}

// ───────── input (the only thing a client controls) ─────────

/** Sanitize and store a player's input. Out-of-range values are clamped; unknown actions are ignored. */
export function setInput(st: MatchState, playerId: string, raw: Partial<PlayerInput>): boolean {
  const p = st.players.find((x) => x.id === playerId);
  if (!p) return false;
  const seq = Number(raw.seq);
  if (!Number.isFinite(seq) || seq <= p.lastSeq) return false; // stale / replayed
  let mx = Number(raw.mx) || 0;
  let mz = Number(raw.mz) || 0;
  const len = Math.hypot(mx, mz);
  if (len > 1) {
    mx /= len;
    mz /= len;
  }
  const map = MAP_BY_ID[st.mapId];
  const ax = clamp(Number(raw.ax) || 0, -map.w, map.w);
  const az = clamp(Number(raw.az) || 0, -map.h, map.h);
  const cast = raw.cast && (SLOTS as string[]).includes(raw.cast) ? raw.cast : null;
  const sw = raw.switchTo == null ? null : Number.isInteger(raw.switchTo) && raw.switchTo >= 0 && raw.switchTo < 3 ? raw.switchTo : null;
  p.lastSeq = seq;
  // a cast/switch request stays queued until the next tick consumes it
  p.input = { seq, mx, mz, ax, az, cast: cast ?? p.input.cast, switchTo: sw ?? p.input.switchTo };
  return true;
}

// ───────── helpers ─────────

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const activeHero = (p: Player) => p.heroes[p.active];
export const onField = (p: Player) => !p.eliminated && p.respawn <= 0 && !!activeHero(p)?.alive;
const statusVal = (h: HeroState, t: StatusType) => h.statuses.filter((s) => s.type === t).reduce((m, s) => Math.max(m, s.value), 0);
const hasStatus = (h: HeroState, t: StatusType) => h.statuses.some((s) => s.type === t);
export const heroRadius = (h: HeroState) => ROLE_STATS[HERO_BY_ID[h.heroId].role].radius;

function fx(st: MatchState, e: Omit<FxEvent, "t">) {
  st.events.push({ ...e, t: st.time });
}

function collideObstacle(pos: Vec, r: number, o: Obstacle) {
  if (o.kind === "circle") {
    const dx = pos.x - o.x;
    const dz = pos.z - o.z;
    const d = Math.hypot(dx, dz);
    const min = o.r + r;
    if (d < min && d > 1e-6) {
      pos.x = o.x + (dx / d) * min;
      pos.z = o.z + (dz / d) * min;
    }
  } else {
    const hx = o.w / 2 + r;
    const hz = o.d / 2 + r;
    const dx = pos.x - o.x;
    const dz = pos.z - o.z;
    if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
      const px = hx - Math.abs(dx);
      const pz = hz - Math.abs(dz);
      if (px < pz) pos.x = o.x + Math.sign(dx || 1) * hx;
      else pos.z = o.z + Math.sign(dz || 1) * hz;
    }
  }
}
function segDist(p: Vec, a: Vec, b: Vec) {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const t = clamp(((p.x - a.x) * abx + (p.z - a.z) * abz) / (abx * abx + abz * abz || 1), 0, 1);
  const cx = a.x + abx * t;
  const cz = a.z + abz * t;
  return { d: Math.hypot(p.x - cx, p.z - cz), cx, cz };
}
export function resolveCollisions(st: MatchState, pos: Vec, r: number) {
  const map = MAP_BY_ID[st.mapId];
  for (let i = 0; i < 2; i++) {
    for (const o of map.obstacles) collideObstacle(pos, r, o);
    for (const w of st.walls) {
      const s = segDist(pos, w.a, w.b);
      const min = r + 0.35;
      if (s.d < min && s.d > 1e-6) {
        pos.x = s.cx + ((pos.x - s.cx) / s.d) * min;
        pos.z = s.cz + ((pos.z - s.cz) / s.d) * min;
      }
    }
  }
  pos.x = clamp(pos.x, -map.w / 2 + r, map.w / 2 - r);
  pos.z = clamp(pos.z, -map.h / 2 + r, map.h / 2 - r);
}
function blocked(st: MatchState, p: Vec, r: number): boolean {
  const map = MAP_BY_ID[st.mapId];
  if (Math.abs(p.x) > map.w / 2 || Math.abs(p.z) > map.h / 2) return true;
  for (const o of map.obstacles) {
    if (o.kind === "circle" ? Math.hypot(p.x - o.x, p.z - o.z) < o.r + r : Math.abs(p.x - o.x) < o.w / 2 + r && Math.abs(p.z - o.z) < o.d / 2 + r) return true;
  }
  for (const w of st.walls) if (segDist(p, w.a, w.b).d < r + 0.35) return true;
  return false;
}

/** Players a payload can affect from `src`. Only the active, living hero of each player is on the field. */
function targetsOf(st: MatchState, src: Player, target: Target): Player[] {
  return st.players.filter((p) => {
    if (!onField(p)) return false;
    if (target === "self") return p === src;
    if (target === "enemies") return p.team !== src.team;
    if (target === "allies") return p.team === src.team && p !== src;
    return p.team === src.team; // team
  });
}

function applyPayload(st: MatchState, src: Player, dst: Player, pl: Payload, from: Vec) {
  const h = activeHero(dst);
  if (!h?.alive) return;
  const sh = activeHero(src);
  if (pl.damage && dst.team !== src.team) {
    const mult = (1 + (sh ? statusVal(sh, "power") : 0)) * (1 + statusVal(h, "mark")) * (1 - statusVal(h, "guard"));
    let dmg = Math.round(pl.damage * mult);
    const absorbed = Math.min(h.shield, dmg);
    h.shield -= absorbed;
    dmg -= absorbed;
    h.hp -= dmg;
    src.stats.damage += dmg + absorbed;
    dst.hitFlash = 0.18;
    fx(st, { kind: "hit", pos: { ...dst.pos }, color: "#ffffff", playerId: dst.id });
    if (h.hp <= 0) knockOut(st, src, dst);
  }
  if (pl.heal && dst.team === src.team && h.alive) {
    const before = h.hp;
    h.hp = Math.min(h.maxHp, h.hp + pl.heal);
    src.stats.healing += h.hp - before;
    if (h.hp > before) fx(st, { kind: "heal", pos: { ...dst.pos }, color: "#7dffb0", playerId: dst.id });
  }
  if (pl.shield && dst.team === src.team) {
    h.shield = Math.max(h.shield, pl.shield);
    h.shieldT = Math.max(h.shieldT, pl.shieldDur ?? 3);
    fx(st, { kind: "shield", pos: { ...dst.pos }, color: "#9fd8ff", playerId: dst.id });
  }
  if (pl.energy && dst.team === src.team) h.energy = Math.min(MAX_ENERGY, h.energy + pl.energy);
  if (pl.status) {
    const friendly = pl.status.type === "haste" || pl.status.type === "power" || pl.status.type === "guard";
    if (friendly === (dst.team === src.team)) {
      h.statuses = h.statuses.filter((s) => s.type !== pl.status!.type);
      h.statuses.push({ type: pl.status.type, t: pl.status.dur, value: pl.status.value ?? 0 });
    }
  }
  if (pl.knock && dst.team !== src.team) {
    const dx = dst.pos.x - from.x;
    const dz = dst.pos.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    dst.pos.x += (dx / d) * pl.knock;
    dst.pos.z += (dz / d) * pl.knock;
    resolveCollisions(st, dst.pos, heroRadius(h));
  }
}

function knockOut(st: MatchState, by: Player, p: Player) {
  const h = activeHero(p);
  h.alive = false;
  h.hp = 0;
  h.shield = 0;
  h.statuses = [];
  p.stats.downs++;
  if (by !== p) by.stats.kos++;
  fx(st, { kind: "ko", pos: { ...p.pos }, color: "#ff6a5a", playerId: p.id });
  const mode = MODE_BY_ID[st.mode];
  if (mode.target != null && st.mode !== "crystal" && by.team !== p.team) st.score[by.team] += 1;
  // bring in the next living hero, or the whole team is down
  const next = p.heroes.findIndex((x) => x.alive);
  p.castLock = 0;
  if (next >= 0) {
    p.active = next;
    p.switchFx = 0.6;
    p.switchCd = Math.max(p.switchCd, 1);
    fx(st, { kind: "switch", pos: { ...p.pos }, color: HERO_BY_ID[p.heroes[next].heroId].look.glow, playerId: p.id });
  } else if (mode.respawn != null) p.respawn = mode.respawn;
  else p.eliminated = true;
}

// ───────── abilities ─────────

function aimPoint(p: Player, ab: Ability): Vec {
  const dx = p.input.ax - p.pos.x;
  const dz = p.input.az - p.pos.z;
  const d = Math.hypot(dx, dz);
  if (d <= ab.range || d < 1e-6) return { x: p.input.ax, z: p.input.az };
  return { x: p.pos.x + (dx / d) * ab.range, z: p.pos.z + (dz / d) * ab.range };
}

function applyArea(st: MatchState, src: Player, center: Vec, radius: number, target: Target, pl: Payload) {
  for (const t of targetsOf(st, src, target)) if (Math.hypot(t.pos.x - center.x, t.pos.z - center.z) <= radius + heroRadius(activeHero(t))) applyPayload(st, src, t, pl, center);
}

function runEffect(st: MatchState, p: Player, ab: Ability, e: Effect, color: string) {
  const dir = { x: Math.sin(p.facing), z: Math.cos(p.facing) };
  switch (e.kind) {
    case "projectile": {
      const n = e.count ?? 1;
      for (let i = 0; i < n; i++) {
        const a = p.facing + (n > 1 ? (i - (n - 1) / 2) * (e.spread ?? 0.2) : 0);
        const d = { x: Math.sin(a), z: Math.cos(a) };
        st.projectiles.push({ id: st.nextId++, owner: p.id, team: p.team, pos: { x: p.pos.x + d.x * 0.9, z: p.pos.z + d.z * 0.9 }, dir: d, speed: e.speed, left: e.range, radius: e.radius, pierce: !!e.pierce, hit: [], payload: e.payload, color });
      }
      break;
    }
    case "area": {
      const c = e.at === "self" ? { ...p.pos } : aimPoint(p, ab);
      if (e.delay) st.zones.push({ id: st.nextId++, owner: p.id, team: p.team, pos: c, radius: e.radius, left: e.delay, tick: 0, next: e.delay, target: e.target, payload: e.payload, color, oneShot: true });
      else {
        applyArea(st, p, c, e.radius, e.target, e.payload);
        fx(st, { kind: "cast", pos: c, color, radius: e.radius, playerId: p.id });
      }
      break;
    }
    case "cone": {
      for (const t of targetsOf(st, p, "enemies")) {
        const dx = t.pos.x - p.pos.x;
        const dz = t.pos.z - p.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > e.range + heroRadius(activeHero(t))) continue;
        let da = Math.atan2(dx, dz) - p.facing;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) <= e.angle / 2 || d < 1) applyPayload(st, p, t, e.payload, p.pos);
      }
      fx(st, { kind: "cast", pos: { x: p.pos.x + dir.x * e.range * 0.5, z: p.pos.z + dir.z * e.range * 0.5 }, color, radius: e.range * 0.6, playerId: p.id });
      break;
    }
    case "dash": {
      const sign = e.back ? -1 : 1;
      const r = heroRadius(activeHero(p));
      const hit = new Set<string>();
      const steps = Math.ceil(e.distance / 0.3);
      for (let i = 0; i < steps; i++) {
        const nx = { x: p.pos.x + dir.x * sign * (e.distance / steps), z: p.pos.z + dir.z * sign * (e.distance / steps) };
        if (blocked(st, nx, r)) break;
        p.pos = nx;
        if (e.payload)
          for (const t of targetsOf(st, p, "enemies"))
            if (!hit.has(t.id) && Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z) < 1.4) {
              hit.add(t.id);
              applyPayload(st, p, t, e.payload, p.pos);
            }
      }
      resolveCollisions(st, p.pos, r);
      fx(st, { kind: "dash", pos: { ...p.pos }, color, playerId: p.id });
      break;
    }
    case "zone": {
      const c = e.at === "self" ? { ...p.pos } : aimPoint(p, ab);
      st.zones.push({ id: st.nextId++, owner: p.id, team: p.team, pos: c, radius: e.radius, left: e.duration, tick: e.tick, next: 0, target: e.target, payload: e.payload, color });
      break;
    }
    case "wall": {
      const c = aimPoint(p, ab);
      const perp = { x: dir.z, z: -dir.x };
      st.walls.push({ id: st.nextId++, a: { x: c.x - (perp.x * e.length) / 2, z: c.z - (perp.z * e.length) / 2 }, b: { x: c.x + (perp.x * e.length) / 2, z: c.z + (perp.z * e.length) / 2 }, left: e.duration, team: p.team });
      // anyone standing in it is pushed out
      for (const q of st.players) if (onField(q)) resolveCollisions(st, q.pos, heroRadius(activeHero(q)));
      fx(st, { kind: "cast", pos: c, color, radius: e.length / 2, playerId: p.id });
      break;
    }
    case "self":
      applyPayload(st, p, p, e.payload, p.pos);
      fx(st, { kind: "cast", pos: { ...p.pos }, color, radius: 1.2, playerId: p.id });
      break;
  }
}

/** Validated cast. Returns why it was refused (for UI feedback) or null on success. */
export function tryCast(st: MatchState, p: Player, slot: Slot): string | null {
  const h = activeHero(p);
  if (!onField(p)) return "dead";
  const def = HERO_BY_ID[h.heroId];
  const ab = def.abilities[slot];
  if (p.castLock > 0) return "casting";
  if (hasStatus(h, "stun")) return "stunned";
  if (slot !== "basic" && hasStatus(h, "silence")) return "silenced";
  if (h.cds[slot] > 0) return "cooldown";
  if (h.energy < ab.cost) return "energy";
  h.energy -= ab.cost;
  h.cds[slot] = ab.cd;
  p.castLock = ab.castTime;
  p.castSlot = slot;
  for (const e of ab.effects) runEffect(st, p, ab, e, def.look.glow);
  return null;
}

export function trySwitch(st: MatchState, p: Player, idx: number): string | null {
  if (!onField(p)) return "dead";
  if (idx === p.active || idx < 0 || idx >= p.heroes.length) return "same";
  if (!p.heroes[idx].alive) return "down";
  if (p.switchCd > 0) return "cooldown";
  if (p.castLock > 0) return "casting";
  if (hasStatus(activeHero(p), "stun")) return "stunned";
  p.active = idx;
  p.switchCd = SWITCH_CD;
  p.switchFx = 0.6;
  fx(st, { kind: "switch", pos: { ...p.pos }, color: HERO_BY_ID[p.heroes[idx].heroId].look.glow, playerId: p.id });
  return null;
}

// ───────── step ─────────

export function step(st: MatchState, dt = TICK) {
  if (st.phase === "ended") return;
  st.tick++;
  if (st.phase === "countdown") {
    st.countdown -= dt;
    if (st.countdown <= 0) st.phase = "live";
    return;
  }
  st.time += dt;
  const map = MAP_BY_ID[st.mapId];
  const mode = MODE_BY_ID[st.mode];

  for (const p of st.players) {
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    p.switchFx = Math.max(0, p.switchFx - dt);
    if (p.eliminated) continue;
    if (p.respawn > 0) {
      p.respawn -= dt;
      if (p.respawn <= 0) {
        p.heroes = p.heroes.map((h) => ({ ...heroState(h.heroId), cds: h.cds }));
        p.active = 0;
        const idx = st.players.filter((q) => q.team === p.team).indexOf(p);
        p.pos = spawnPoint(map, st.mode, p, mode.teams === 2 ? idx : st.players.indexOf(p), st.players.length);
        p.switchFx = 0.6;
      }
      continue;
    }
    // timers for every hero (inactive heroes keep their own state)
    p.heroes.forEach((h, i) => {
      for (const s of SLOTS) h.cds[s] = Math.max(0, h.cds[s] - dt);
      if (!h.alive) return;
      h.statuses = h.statuses.map((s) => ({ ...s, t: s.t - dt })).filter((s) => s.t > 0);
      h.shieldT = Math.max(0, h.shieldT - dt);
      if (h.shieldT <= 0) h.shield = 0;
      const active = i === p.active;
      h.energy = Math.min(MAX_ENERGY, h.energy + (active ? ENERGY_REGEN : ENERGY_REGEN_BENCH) * dt);
      if (!active) h.hp = Math.min(h.maxHp, h.hp + BENCH_HEAL * dt);
    });
    p.switchCd = Math.max(0, p.switchCd - dt);
    p.castLock = Math.max(0, p.castLock - dt);
    if (p.castLock <= 0) p.castSlot = null;

    const h = activeHero(p);
    const stunned = hasStatus(h, "stun");
    if (p.input.switchTo != null) {
      trySwitch(st, p, p.input.switchTo);
      p.input.switchTo = null;
    }
    const hero = activeHero(p);
    // facing follows the aim point
    const fdx = p.input.ax - p.pos.x;
    const fdz = p.input.az - p.pos.z;
    if (!stunned && Math.hypot(fdx, fdz) > 0.2) p.facing = Math.atan2(fdx, fdz);
    // movement
    const r = heroRadius(hero);
    let speed = ROLE_STATS[HERO_BY_ID[hero.heroId].role].speed * (1 + statusVal(hero, "haste")) * (1 - statusVal(hero, "slow"));
    for (const f of map.fields) if (f.kind === "mist" && Math.hypot(p.pos.x - f.x, p.pos.z - f.z) < f.r) speed *= 0.7;
    if (stunned || p.castLock > 0.25) speed *= stunned ? 0 : 0.4;
    p.vel = { x: p.input.mx * speed, z: p.input.mz * speed };
    p.pos.x += p.vel.x * dt;
    p.pos.z += p.vel.z * dt;
    resolveCollisions(st, p.pos, r);
    if (p.input.cast) {
      tryCast(st, p, p.input.cast);
      p.input.cast = null;
    }
    // environment
    for (const f of map.fields) if (f.kind === "spring" && Math.hypot(p.pos.x - f.x, p.pos.z - f.z) < f.r && hero.alive) hero.hp = Math.min(hero.maxHp, hero.hp + 25 * dt);
    for (const pk of st.pickups) {
      if (pk.ready > 0 || Math.hypot(p.pos.x - pk.pos.x, p.pos.z - pk.pos.z) > 1.3) continue;
      if (pk.kind === "heal") hero.hp = Math.min(hero.maxHp, hero.hp + 200);
      else hero.energy = Math.min(MAX_ENERGY, hero.energy + 50);
      pk.ready = PICKUP_RESPAWN;
      fx(st, { kind: pk.kind === "heal" ? "heal" : "shield", pos: { ...pk.pos }, color: pk.kind === "heal" ? "#7dffb0" : "#9fd8ff", playerId: p.id });
    }
  }
  for (const pk of st.pickups) pk.ready = Math.max(0, pk.ready - dt);

  // projectiles
  for (const pr of st.projectiles) {
    const move = pr.speed * dt;
    pr.pos.x += pr.dir.x * move;
    pr.pos.z += pr.dir.z * move;
    pr.left -= move;
    if (blocked(st, pr.pos, 0.05)) pr.left = 0;
    const owner = st.players.find((x) => x.id === pr.owner);
    if (!owner) {
      pr.left = 0;
      continue;
    }
    for (const t of st.players) {
      if (pr.left <= 0 || t.team === pr.team || !onField(t) || pr.hit.includes(t.id)) continue;
      if (Math.hypot(t.pos.x - pr.pos.x, t.pos.z - pr.pos.z) < pr.radius + heroRadius(activeHero(t))) {
        applyPayload(st, owner, t, pr.payload, pr.pos);
        pr.hit.push(t.id);
        if (!pr.pierce) pr.left = 0;
      }
    }
  }
  st.projectiles = st.projectiles.filter((p) => p.left > 0);

  // zones
  for (const z of st.zones) {
    z.left -= dt;
    const owner = st.players.find((x) => x.id === z.owner);
    if (!owner) {
      z.left = 0;
      continue;
    }
    if (z.oneShot) {
      if (z.left <= 0) {
        applyArea(st, owner, z.pos, z.radius, z.target, z.payload);
        fx(st, { kind: "cast", pos: { ...z.pos }, color: z.color, radius: z.radius, playerId: z.owner });
      }
      continue;
    }
    z.next -= dt;
    if (z.next <= 0) {
      applyArea(st, owner, z.pos, z.radius, z.target, z.payload);
      z.next += z.tick;
    }
  }
  st.zones = st.zones.filter((z) => z.left > 0);
  for (const w of st.walls) w.left -= dt;
  st.walls = st.walls.filter((w) => w.left > 0);

  // crystals
  if (st.mode === "crystal") {
    for (const c of st.crystals) {
      const inside = st.players.filter((p) => onField(p) && Math.hypot(p.pos.x - c.pos.x, p.pos.z - c.pos.z) < c.radius);
      const teams = new Set(inside.map((p) => p.team));
      if (teams.size === 1) {
        const team = [...teams][0];
        const dirn = team === 0 ? -1 : 1;
        const before = c.owner;
        c.progress = clamp(c.progress + (dirn * dt * Math.min(2, inside.length)) / CAPTURE_TIME, -1, 1);
        if (Math.abs(c.progress) >= 1) c.owner = team;
        else if (c.owner != null && Math.sign(c.progress) !== (c.owner === 0 ? -1 : 1)) c.owner = null;
        if (before !== c.owner && c.owner != null) fx(st, { kind: "capture", pos: { ...c.pos }, color: c.owner === 0 ? "#5aa9ff" : "#ff7a5a", radius: c.radius });
      }
      if (c.owner != null) st.score[c.owner] += dt;
    }
  }

  st.events = st.events.filter((e) => e.t > st.time - 1.2);
  checkVictory(st);
}

const hpFraction = (p: Player) => p.heroes.reduce((s, h) => s + Math.max(0, h.hp) / h.maxHp, 0) / p.heroes.length;

function end(st: MatchState, team: number | null, reason: string) {
  st.phase = "ended";
  const winnerPlayer = team == null ? null : MODE_BY_ID[st.mode].teams === "solo" ? (st.players.find((p) => p.team === team)?.id ?? null) : null;
  st.winner = { team, playerId: winnerPlayer, reason };
}

function checkVictory(st: MatchState) {
  const mode = MODE_BY_ID[st.mode];
  if (mode.target == null) {
    // elimination
    const teams = [...new Set(st.players.filter((p) => !p.eliminated).map((p) => p.team))];
    if (teams.length <= 1) return end(st, teams[0] ?? null, "כל הגיבורים של היריב הופלו");
    if (st.time >= st.timeLimit) {
      const ranked = st.players.slice().sort((a, b) => hpFraction(b) - hpFraction(a));
      if (Math.abs(hpFraction(ranked[0]) - hpFraction(ranked[1])) < 0.005) return end(st, null, "תיקו בתום הזמן");
      return end(st, ranked[0].team, "יותר חיים בתום הזמן");
    }
    return;
  }
  const best = Math.max(...st.score);
  if (best >= mode.target) return end(st, st.score.indexOf(best), "הגיע לניקוד היעד");
  // everyone else left (forfeit)
  const active = [...new Set(st.players.filter((p) => !p.eliminated).map((p) => p.team))];
  if (active.length <= 1 && st.players.length > 1) return end(st, active[0] ?? null, "היריבים עזבו");
  if (st.time >= st.timeLimit) {
    const winners = st.score.filter((s) => s === best).length;
    return end(st, winners > 1 ? null : st.score.indexOf(best), winners > 1 ? "תיקו בתום הזמן" : "הניקוד הגבוה בתום הזמן");
  }
}

/** Player leaves for good (disconnect grace expired): their heroes leave the field. */
export function forfeit(st: MatchState, playerId: string) {
  const p = st.players.find((x) => x.id === playerId);
  if (!p) return;
  p.eliminated = true;
  p.connected = false;
  for (const h of p.heroes) h.alive = false;
  checkVictory(st);
}
