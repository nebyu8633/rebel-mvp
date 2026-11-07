/**
 * LifeOS Arena — authoritative real-time game server (WebSocket).
 *
 * Runs as its own long-lived Node process (a Next.js/Vercel deployment can't hold WebSockets):
 *   npm run arena:server            (PORT=8787 by default)
 *
 * The server owns the match state: clients only send movement / aim / cast / switch requests,
 * which go through the same validation as practice (cooldowns, energy, cast locks, ranges).
 * Positions, damage, KOs, results, Hero XP and ratings are computed here.
 *
 * Identity & ownership:
 * - Cloud (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set): the client sends its Supabase access
 *   token; the server verifies it and loads the player's XP ledger to know which heroes they own.
 *   Results, Hero XP and ratings are written to the database by the server.
 * - Guest (no Supabase): identity is a random guest id; only the 3 starter heroes can be used
 *   online (the server can't verify progression stored in a browser). Results are not recorded.
 */
import { WebSocketServer, type WebSocket } from "ws";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { createMatch, forfeit, setInput, step, TICK } from "../src/lib/arena/engine";
import { MAPS, MODE_BY_ID } from "../src/lib/arena/maps";
import { compactSnapshot, MAX_INPUTS_PER_SECOND, MAX_MESSAGE_BYTES, PROTOCOL_VERSION, type ClientMsg, type PlayerResult, type ServerMsg } from "../src/lib/arena/protocol";
import { ownedIds, ratingDelta, validTeam, type LedgerEntry } from "../src/lib/arena/roster";
import { STARTER_HEROES } from "../src/lib/arena/heroes";
import type { MatchState, ModeId } from "../src/lib/arena/types";

const PORT = Number(process.env.PORT ?? process.env.ARENA_PORT ?? 8787);
const GRACE_MS = Number(process.env.ARENA_RECONNECT_GRACE_MS ?? 30_000);
const FFA_WAIT_MS = 20_000;
/** For automated tests only: shorter matches. */
const TIME_LIMIT = process.env.ARENA_TEST_TIME_LIMIT ? Number(process.env.ARENA_TEST_TIME_LIMIT) : undefined;
const ORIGINS = (process.env.ARENA_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const sbUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const admin: SupabaseClient | null = sbUrl && sbKey ? createClient(sbUrl, sbKey, { auth: { persistSession: false } }) : null;

interface Conn {
  ws: WebSocket;
  playerId: string;
  name: string;
  guest: boolean;
  owned: string[];
  matchId: string | null;
  inputs: number[];
  alive: boolean;
}
interface Room {
  state: MatchState;
  keys: Map<string, string>; // playerId → reconnect key
  conns: Map<string, Conn | null>;
  dropped: Map<string, number>; // playerId → disconnect time
  ratings: Map<string, number>;
  heroesUsed: Map<string, Set<string>>;
  guests: Set<string>;
  ended: boolean;
  endedAt: number;
}
interface Ticket {
  conn: Conn;
  heroes: string[];
  at: number;
}

const rooms = new Map<string, Room>();
const queues = new Map<ModeId, Ticket[]>();
const online = new Map<string, Conn>(); // playerId → active connection

function send(c: Conn | null | undefined, m: ServerMsg) {
  if (c && c.ws.readyState === c.ws.OPEN) c.ws.send(JSON.stringify(m));
}
const cleanName = (s: unknown) => (typeof s === "string" ? s.replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 20) : "") || "שחקן";

// ───────── identity ─────────

async function identify(msg: Extract<ClientMsg, { t: "hello" }>): Promise<{ playerId: string; guest: boolean; owned: string[] } | { error: string }> {
  if (msg.token && admin) {
    const { data, error } = await admin.auth.getUser(msg.token);
    if (error || !data.user) return { error: "אימות נכשל — התחברו מחדש" };
    const uid = data.user.id;
    const { data: rows } = await admin.from("xp_events").select("id,kind,ref_id,amount,region,title,at").eq("user_id", uid).limit(20000);
    const ledger: LedgerEntry[] = (rows ?? []).map((r) => ({ id: r.id, kind: r.kind, refId: r.ref_id, amount: r.amount, region: r.region, title: r.title, at: r.at }));
    return { playerId: uid, guest: false, owned: ownedIds(ledger) };
  }
  const gid = typeof msg.guestId === "string" && /^g_[a-f0-9]{24}$/.test(msg.guestId) ? msg.guestId : `g_${randomBytes(12).toString("hex")}`;
  return { playerId: gid, guest: true, owned: [...STARTER_HEROES] };
}

// ───────── matchmaking ─────────

function needed(mode: ModeId) {
  return MODE_BY_ID[mode].min;
}

function tryStart(mode: ModeId) {
  const q = (queues.get(mode) ?? []).filter((t) => t.conn.alive && !t.conn.matchId);
  queues.set(mode, q);
  const def = MODE_BY_ID[mode];
  let take = 0;
  if (q.length >= def.max) take = def.max;
  else if (mode === "ffa" && q.length >= def.min && Date.now() - q[def.min - 1].at > FFA_WAIT_MS) take = q.length;
  else if (mode !== "ffa" && q.length >= def.min) take = def.min;
  if (!take) {
    for (const t of q) send(t.conn, { t: "queued", mode, waiting: q.length, needed: needed(mode) });
    return;
  }
  const group = q.splice(0, take);
  const matchId = randomUUID();
  const mapId = MAPS[Math.floor(Math.random() * MAPS.length)].id;
  const state = createMatch({
    id: matchId,
    mode,
    mapId,
    seed: Math.floor(Math.random() * 1e9),
    timeLimit: TIME_LIMIT,
    players: group.map((t, i) => ({ id: t.conn.playerId, name: t.conn.name, kind: "human", team: def.teams === 2 ? i % 2 : i, heroes: t.heroes })),
  });
  const room: Room = { state, keys: new Map(), conns: new Map(), dropped: new Map(), ratings: new Map(), heroesUsed: new Map(), guests: new Set(), ended: false, endedAt: 0 };
  for (const t of group) {
    const key = randomBytes(16).toString("hex");
    room.keys.set(t.conn.playerId, key);
    room.conns.set(t.conn.playerId, t.conn);
    room.heroesUsed.set(t.conn.playerId, new Set([t.heroes[0]]));
    if (t.conn.guest) room.guests.add(t.conn.playerId);
    t.conn.matchId = matchId;
  }
  rooms.set(matchId, room);
  void loadRatings(room);
  for (const t of group)
    send(t.conn, {
      t: "match",
      matchId,
      key: room.keys.get(t.conn.playerId)!,
      mode,
      mapId,
      you: t.conn.playerId,
      players: state.players.map((p) => ({ id: p.id, name: p.name, team: p.team, heroes: p.heroes.map((h) => h.heroId), guest: room.guests.has(p.id) })),
    });
  console.log(`[arena] match ${matchId.slice(0, 8)} ${mode} on ${mapId} with ${group.length} players`);
}

async function loadRatings(room: Room) {
  for (const p of room.state.players) room.ratings.set(p.id, 1000);
  if (!admin) return;
  const ids = room.state.players.filter((p) => !room.guests.has(p.id)).map((p) => p.id);
  if (!ids.length) return;
  const { data } = await admin.from("arena_profiles").select("user_id,rating").in("user_id", ids);
  for (const r of data ?? []) room.ratings.set(r.user_id, Number((r.rating as Record<string, number>)?.[room.state.mode] ?? 1000));
}

// ───────── results (computed and recorded server-side) ─────────

async function finish(room: Room) {
  room.ended = true;
  room.endedAt = Date.now();
  const st = room.state;
  const mode = MODE_BY_ID[st.mode];
  const w = st.winner;
  const results: PlayerResult[] = st.players.map((p) => {
    const won = w?.team != null && w.team === p.team;
    const draw = w?.team == null;
    const used = [...(room.heroesUsed.get(p.id) ?? [])];
    const xp = Math.round((mode.heroXp.play + (won ? mode.heroXp.win : 0)) / Math.max(1, used.length));
    const heroXp = Object.fromEntries(used.map((h) => [h, p.connected || won ? xp : 0]));
    const before = room.ratings.get(p.id) ?? 1000;
    // rating vs the average of opponents (duel/team modes); ffa by placement
    const opp = st.players.filter((q) => q.team !== p.team);
    const oppAvg = opp.reduce((s, q) => s + (room.ratings.get(q.id) ?? 1000), 0) / Math.max(1, opp.length);
    const ranked = room.guests.has(p.id) ? null : before + ratingDelta(before, oppAvg, draw ? 0.5 : won ? 1 : 0);
    return { playerId: p.id, name: p.name, team: p.team, won, draw, heroXp, ratingBefore: room.guests.has(p.id) ? null : before, ratingAfter: ranked, stats: { ...p.stats, damage: Math.round(p.stats.damage), healing: Math.round(p.stats.healing) } };
  });
  let recorded = false;
  if (admin) {
    try {
      const real = results.filter((r) => !room.guests.has(r.playerId));
      if (real.length) {
        await admin.from("arena_matches").insert(
          real.map((r) => ({ user_id: r.playerId, id: st.id, mode: st.mode, map_id: st.mapId, won: r.won, draw: r.draw, result: r, players: results.map((x) => ({ name: x.name, team: x.team, won: x.won })), duration: Math.round(st.time), played_at: new Date().toISOString() })),
        );
        for (const r of real) {
          const { data } = await admin.from("arena_profiles").select("hero_xp,rating,matches,wins").eq("user_id", r.playerId).maybeSingle();
          const heroXp = { ...((data?.hero_xp as Record<string, number>) ?? {}) };
          for (const [h, x] of Object.entries(r.heroXp)) heroXp[h] = (heroXp[h] ?? 0) + x;
          const rating = { ...((data?.rating as Record<string, number>) ?? {}), [st.mode]: r.ratingAfter ?? 1000 };
          await admin.from("arena_profiles").upsert({ user_id: r.playerId, id: "arena", hero_xp: heroXp, rating, matches: (data?.matches ?? 0) + 1, wins: (data?.wins ?? 0) + (r.won ? 1 : 0), updated_at: new Date().toISOString() }, { onConflict: "user_id,id" });
        }
        recorded = true;
      }
    } catch (e) {
      console.error("[arena] recording results failed", e);
    }
  }
  for (const [pid, c] of room.conns) {
    send(c, { t: "end", matchId: st.id, winner: w, results, recorded });
    if (c) c.matchId = null;
    void pid;
  }
  console.log(`[arena] match ${st.id.slice(0, 8)} ended: ${w?.reason ?? "?"}`);
}

// ───────── game loop ─────────

setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (room.ended) {
      if (now - room.endedAt > 60_000) rooms.delete(id);
      continue;
    }
    // disconnected players: no bot takes over; after the grace period they forfeit
    for (const [pid, at] of room.dropped) if (now - at > GRACE_MS) {
      forfeit(room.state, pid);
      room.dropped.delete(pid);
    }
    step(room.state, TICK);
    for (const p of room.state.players) room.heroesUsed.get(p.id)?.add(p.heroes[p.active].heroId);
    const snap = compactSnapshot(room.state);
    for (const [pid, c] of room.conns) send(c, { t: "snap", s: snap, ack: room.state.players.find((p) => p.id === pid)?.lastSeq ?? 0 });
    if (room.state.phase === "ended") void finish(room);
  }
  for (const mode of queues.keys()) if (mode === "ffa") tryStart(mode);
}, TICK * 1000);

// ───────── connections ─────────

const wss = new WebSocketServer({
  port: PORT,
  maxPayload: MAX_MESSAGE_BYTES,
  verifyClient: (info: { origin: string }) => !ORIGINS.length || ORIGINS.includes(info.origin),
});

wss.on("connection", (ws) => {
  let conn: Conn | null = null;
  ws.on("message", async (raw) => {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!conn) {
      if (msg.t !== "hello" || msg.v !== PROTOCOL_VERSION) return ws.close(4000, "bad hello");
      const id = await identify(msg);
      if ("error" in id) {
        ws.send(JSON.stringify({ t: "error", code: "auth", message: id.error } satisfies ServerMsg));
        return ws.close(4001, "auth");
      }
      // one live connection per player
      online.get(id.playerId)?.ws.close(4002, "replaced");
      conn = { ws, playerId: id.playerId, name: cleanName(msg.name), guest: id.guest, owned: id.owned, matchId: null, inputs: [], alive: true };
      online.set(id.playerId, conn);
      send(conn, { t: "welcome", playerId: id.playerId, guest: id.guest, owned: id.owned, name: conn.name });
      // reconnect into a running match: by resume key, or simply because this verified identity is in one
      const byKey = msg.resume ? rooms.get(msg.resume.matchId) : null;
      const room = byKey && byKey.keys.get(id.playerId) === msg.resume?.key ? byKey : [...rooms.values()].find((r) => !r.ended && r.keys.has(id.playerId) && !r.state.players.find((x) => x.id === id.playerId)?.eliminated);
      {
        if (room && !room.ended) {
          room.conns.set(id.playerId, conn);
          room.dropped.delete(id.playerId);
          const p = room.state.players.find((x) => x.id === id.playerId);
          if (p) p.connected = true;
          conn.matchId = room.state.id;
          send(conn, { t: "match", matchId: room.state.id, key: room.keys.get(id.playerId)!, mode: room.state.mode, mapId: room.state.mapId, you: id.playerId, players: room.state.players.map((x) => ({ id: x.id, name: x.name, team: x.team, heroes: x.heroes.map((h) => h.heroId), guest: room.guests.has(x.id) })) });
        }
      }
      return;
    }
    const c = conn;
    switch (msg.t) {
      case "queue": {
        if (c.matchId) return send(c, { t: "error", code: "busy", message: "כבר במשחק" });
        if (!MODE_BY_ID[msg.mode]) return send(c, { t: "error", code: "mode", message: "מצב לא קיים" });
        if (!validTeam(msg.heroes, c.owned)) return send(c, { t: "error", code: "team", message: c.guest ? "במשחק מקוון כאורח אפשר רק את שלושת הגיבורים ההתחלתיים" : "צוות לא תקין: 3 גיבורים שונים שבבעלותך" });
        for (const [m, q] of queues) queues.set(m, q.filter((t) => t.conn.playerId !== c.playerId));
        queues.set(msg.mode, [...(queues.get(msg.mode) ?? []), { conn: c, heroes: msg.heroes, at: Date.now() }]);
        tryStart(msg.mode);
        return;
      }
      case "cancel":
        for (const [m, q] of queues) queues.set(m, q.filter((t) => t.conn !== c));
        return;
      case "input": {
        const now = Date.now();
        c.inputs = c.inputs.filter((t) => now - t < 1000);
        if (c.inputs.length >= MAX_INPUTS_PER_SECOND) return; // flood protection
        c.inputs.push(now);
        const room = c.matchId ? rooms.get(c.matchId) : null;
        if (!room || room.ended) return;
        setInput(room.state, c.playerId, msg);
        return;
      }
      case "leave": {
        const room = c.matchId ? rooms.get(c.matchId) : null;
        if (room && !room.ended) forfeit(room.state, c.playerId);
        c.matchId = null;
        return;
      }
      case "ping":
        return send(c, { t: "pong", at: Number(msg.at) || 0 });
    }
  });
  ws.on("close", () => {
    if (!conn) return;
    conn.alive = false;
    if (online.get(conn.playerId) === conn) online.delete(conn.playerId);
    for (const [m, q] of queues) queues.set(m, q.filter((t) => t.conn !== conn));
    const room = conn.matchId ? rooms.get(conn.matchId) : null;
    if (room && !room.ended && room.conns.get(conn.playerId) === conn) {
      room.conns.set(conn.playerId, null);
      room.dropped.set(conn.playerId, Date.now());
      const p = room.state.players.find((x) => x.id === conn!.playerId);
      if (p) {
        p.connected = false;
        p.input = { ...p.input, mx: 0, mz: 0, cast: null, switchTo: null };
      }
    }
  });
});

console.log(`[arena] game server on ws://localhost:${PORT} · ${admin ? "Supabase: results recorded, ownership verified" : "guest mode: starter heroes only, results not recorded"}`);
