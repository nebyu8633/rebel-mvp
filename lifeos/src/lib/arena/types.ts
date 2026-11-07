/**
 * Arena — shared types. Everything in src/lib/arena is plain TypeScript with relative imports
 * only, so the same engine runs in the browser (practice) and in the Node game server.
 */
export type RegionId = "wealth" | "health" | "knowledge" | "career" | "social" | "mind";
export type Role = "tank" | "damage" | "support";
export type Rarity = "common" | "rare" | "epic" | "legendary";
export type Slot = "basic" | "special" | "defense" | "ultimate";
export const SLOTS: Slot[] = ["basic", "special", "defense", "ultimate"];

export type StatusType = "slow" | "stun" | "silence" | "haste" | "power" | "mark" | "guard";
export type Target = "enemies" | "allies" | "self" | "team"; // team = allies + self

export interface Payload {
  damage?: number;
  heal?: number;
  shield?: number;
  shieldDur?: number;
  energy?: number;
  knock?: number;
  status?: { type: StatusType; dur: number; value?: number };
}

export type Effect =
  | { kind: "projectile"; speed: number; range: number; radius: number; pierce?: boolean; count?: number; spread?: number; payload: Payload }
  | { kind: "area"; at: "self" | "aim"; radius: number; delay?: number; target: Target; payload: Payload }
  | { kind: "cone"; range: number; angle: number; payload: Payload }
  | { kind: "dash"; distance: number; back?: boolean; payload?: Payload }
  | { kind: "zone"; at: "self" | "aim"; radius: number; duration: number; tick: number; target: Target; payload: Payload }
  | { kind: "wall"; length: number; duration: number }
  | { kind: "self"; payload: Payload };

export interface Ability {
  id: string;
  name: string;
  slot: Slot;
  cd: number;
  cost: number;
  /** Aim range for "aim" targeted effects (the target point is clamped to it). */
  range: number;
  /** Seconds the hero is locked in the animation — no switching, no other casts. */
  castTime: number;
  effects: Effect[];
  desc: string;
}

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  region: RegionId;
  role: Role;
  rarity: Rarity;
  story: string;
  /** Visual identity (procedural model). */
  look: { body: string; trim: string; glow: string; weapon: "shield" | "staff" | "blade" | "orb" | "hammer" | "bow" | "fan" | "tome" };
  abilities: Record<Slot, Ability>;
}

export interface Vec {
  x: number;
  z: number;
}

export interface Status {
  type: StatusType;
  t: number;
  value: number;
}

export interface HeroState {
  heroId: string;
  hp: number;
  maxHp: number;
  energy: number;
  shield: number;
  shieldT: number;
  cds: Record<Slot, number>;
  statuses: Status[];
  alive: boolean;
}

export interface PlayerInput {
  seq: number;
  /** Movement direction, |m| ≤ 1. */
  mx: number;
  mz: number;
  /** Aim point (world). */
  ax: number;
  az: number;
  cast: Slot | null;
  switchTo: number | null;
}

export interface Player {
  id: string;
  name: string;
  /** "bot" players are training bots and are always labelled as such. */
  kind: "human" | "bot";
  team: number;
  heroes: HeroState[];
  active: number;
  pos: Vec;
  facing: number;
  vel: Vec;
  switchCd: number;
  /** Remaining cast lock (no switching / casting while > 0). */
  castLock: number;
  castSlot: Slot | null;
  respawn: number;
  eliminated: boolean;
  connected: boolean;
  input: PlayerInput;
  lastSeq: number;
  stats: { damage: number; healing: number; kos: number; downs: number };
  /** Short-lived flags for animation. */
  hitFlash: number;
  switchFx: number;
}

export interface Projectile {
  id: number;
  owner: string;
  team: number;
  pos: Vec;
  dir: Vec;
  speed: number;
  left: number;
  radius: number;
  pierce: boolean;
  hit: string[];
  payload: Payload;
  color: string;
}

export interface Zone {
  id: number;
  owner: string;
  team: number;
  pos: Vec;
  radius: number;
  left: number;
  tick: number;
  next: number;
  target: Target;
  payload: Payload;
  color: string;
  /** Delayed one-shot area (telegraphed). */
  oneShot?: boolean;
}

export interface Wall {
  id: number;
  a: Vec;
  b: Vec;
  left: number;
  team: number;
}

export interface Crystal {
  id: number;
  pos: Vec;
  radius: number;
  owner: number | null;
  progress: number; // -1..1 toward a team (team 0 → negative, team 1 → positive)
}

export interface FxEvent {
  t: number;
  kind: "cast" | "hit" | "heal" | "shield" | "ko" | "switch" | "dash" | "capture";
  pos: Vec;
  color: string;
  radius?: number;
  playerId?: string;
}

export type ModeId = "duel" | "ffa" | "team2" | "team3" | "crystal";

export interface MatchState {
  id: string;
  mode: ModeId;
  mapId: string;
  tick: number;
  time: number;
  timeLimit: number;
  phase: "countdown" | "live" | "ended";
  countdown: number;
  players: Player[];
  projectiles: Projectile[];
  zones: Zone[];
  walls: Wall[];
  crystals: Crystal[];
  pickups: Array<{ id: number; kind: "heal" | "energy"; pos: Vec; ready: number }>;
  score: number[];
  events: FxEvent[];
  winner: { team: number | null; playerId: string | null; reason: string } | null;
  nextId: number;
  seed: number;
}
