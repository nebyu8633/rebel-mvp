/** Wire protocol between the browser and the arena game server (JSON over WebSocket). */
import type { MatchState, ModeId, PlayerInput } from "./types";

export const PROTOCOL_VERSION = 1;
export const MAX_MESSAGE_BYTES = 2048;
export const MAX_INPUTS_PER_SECOND = 45;

export type ClientMsg =
  | { t: "hello"; v: number; name: string; token?: string | null; guestId?: string | null; resume?: { matchId: string; key: string } | null }
  | { t: "queue"; mode: ModeId; heroes: string[] }
  | { t: "cancel" }
  | ({ t: "input" } & PlayerInput)
  | { t: "leave" }
  | { t: "ping"; at: number };

export interface PlayerResult {
  playerId: string;
  name: string;
  team: number;
  won: boolean;
  draw: boolean;
  heroXp: Record<string, number>;
  ratingBefore: number | null;
  ratingAfter: number | null;
  stats: { damage: number; healing: number; kos: number; downs: number };
}

export type ServerMsg =
  | { t: "welcome"; playerId: string; guest: boolean; owned: string[]; name: string }
  | { t: "queued"; mode: ModeId; waiting: number; needed: number }
  | { t: "match"; matchId: string; key: string; mode: ModeId; mapId: string; you: string; players: Array<{ id: string; name: string; team: number; heroes: string[]; guest: boolean }> }
  | { t: "snap"; s: MatchState; ack: number }
  | { t: "end"; matchId: string; winner: MatchState["winner"]; results: PlayerResult[]; recorded: boolean }
  | { t: "error"; code: string; message: string }
  | { t: "pong"; at: number };

const r1 = (n: number) => Math.round(n * 100) / 100;
/** Smaller snapshot for the wire: rounded numbers, no inputs of other players. */
export function compactSnapshot(s: MatchState): MatchState {
  return {
    ...s,
    time: r1(s.time),
    countdown: r1(s.countdown),
    score: s.score.map(r1),
    players: s.players.map((p) => ({
      ...p,
      input: { seq: 0, mx: 0, mz: 0, ax: 0, az: 0, cast: null, switchTo: null },
      pos: { x: r1(p.pos.x), z: r1(p.pos.z) },
      vel: { x: r1(p.vel.x), z: r1(p.vel.z) },
      facing: r1(p.facing),
      heroes: p.heroes.map((h) => ({ ...h, hp: Math.round(h.hp), energy: Math.round(h.energy), shield: Math.round(h.shield), cds: { basic: r1(h.cds.basic), special: r1(h.cds.special), defense: r1(h.cds.defense), ultimate: r1(h.cds.ultimate) } })),
    })),
    projectiles: s.projectiles.map((p) => ({ ...p, pos: { x: r1(p.pos.x), z: r1(p.pos.z) }, hit: [] })),
  };
}
