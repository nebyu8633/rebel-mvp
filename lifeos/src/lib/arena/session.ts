"use client";
/**
 * A running match as the UI sees it — either a local PRACTICE match (engine in the browser,
 * training bots) or an ONLINE match (state from the authoritative game server).
 */
import { createMatch, setInput, step, TICK, type PlayerSetup } from "./engine";
import { botInput, newBotMemory, type BotLevel, type BotMemory } from "./bot";
import { MODE_BY_ID } from "./maps";
import { PROTOCOL_VERSION, type PlayerResult, type ServerMsg } from "./protocol";
import type { MatchState, ModeId, PlayerInput, Slot } from "./types";

export interface Frame {
  prev: MatchState;
  cur: MatchState;
  /** performance.now() when `cur` became current. */
  at: number;
}

export interface EndInfo {
  winner: MatchState["winner"];
  results: PlayerResult[];
  recorded: boolean;
  practice: boolean;
}

export interface Session {
  kind: "practice" | "online";
  you: string;
  frame(): Frame | null;
  /** Called by the controls every animation frame. */
  control(c: { mx: number; mz: number; ax: number; az: number }): void;
  cast(slot: Slot): void;
  switchTo(i: number): void;
  leave(): void;
  onEnd(cb: (e: EndInfo) => void): void;
  dispose(): void;
  /** Online: latency estimate in ms. */
  ping?: number;
}

let seqBase = Date.now();
const nextSeq = () => ++seqBase;

// ───────── practice ─────────

export function practiceSession(o: { mode: ModeId; mapId: string; heroes: string[]; name: string; level: BotLevel; botTeams: string[][]; timeLimit?: number }): Session {
  const mode = MODE_BY_ID[o.mode];
  const total = o.mode === "duel" ? 2 : o.mode === "ffa" ? 4 : o.mode === "team3" ? 6 : 4;
  const players: PlayerSetup[] = [{ id: "you", name: o.name, kind: "human", team: 0, heroes: o.heroes }];
  for (let i = 1; i < total; i++) players.push({ id: `bot${i}`, name: `בוט אימון ${i}`, kind: "bot", team: mode.teams === 2 ? i % 2 : i, heroes: o.botTeams[(i - 1) % o.botTeams.length] });
  const st = createMatch({ id: `practice-${Date.now()}`, mode: o.mode, mapId: o.mapId, players, seed: Date.now() % 1e9, timeLimit: o.timeLimit });
  const mem = new Map<string, BotMemory>(players.filter((p) => p.kind === "bot").map((p) => [p.id, newBotMemory()]));
  let prev = structuredClone(st);
  let at = performance.now();
  let acc = 0;
  let last = performance.now();
  let ctl = { mx: 0, mz: 0, ax: 0, az: 1 };
  let pendingCast: Slot | null = null;
  let pendingSwitch: number | null = null;
  let endCb: ((e: EndInfo) => void) | null = null;
  let ended = false;
  let raf = 0;
  const loop = () => {
    const now = performance.now();
    // catch up after slow frames (up to 1 s) so game time stays real time
    acc += Math.min(1, (now - last) / 1000);
    last = now;
    while (acc >= TICK) {
      acc -= TICK;
      prev = structuredClone(st);
      setInput(st, "you", { seq: nextSeq(), ...ctl, cast: pendingCast, switchTo: pendingSwitch });
      pendingCast = null;
      pendingSwitch = null;
      for (const p of st.players) if (p.kind === "bot") setInput(st, p.id, botInput(st, p, mem.get(p.id)!, o.level, TICK));
      step(st, TICK);
      at = performance.now();
      if (st.phase === "ended" && !ended) {
        ended = true;
        endCb?.({ winner: st.winner, results: practiceResults(st), recorded: false, practice: true });
      }
    }
    if (!ended) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return {
    kind: "practice",
    you: "you",
    frame: () => ({ prev, cur: st, at }),
    control: (c) => (ctl = c),
    cast: (s) => (pendingCast = s),
    switchTo: (i) => (pendingSwitch = i),
    leave: () => {
      if (ended) return;
      ended = true;
      cancelAnimationFrame(raf);
      endCb?.({ winner: { team: null, playerId: null, reason: "יצאת מהאימון" }, results: practiceResults(st), recorded: false, practice: true });
    },
    onEnd: (cb) => (endCb = cb),
    dispose: () => cancelAnimationFrame(raf),
  };
}

function practiceResults(st: MatchState): PlayerResult[] {
  return st.players.map((p) => ({ playerId: p.id, name: p.name, team: p.team, won: st.winner?.team === p.team, draw: st.winner?.team == null, heroXp: {}, ratingBefore: null, ratingAfter: null, stats: { ...p.stats, damage: Math.round(p.stats.damage), healing: Math.round(p.stats.healing) } }));
}

// ───────── online ─────────

export type OnlineStatus = { phase: "connecting" | "ready" | "queued" | "match" | "closed" | "error"; message?: string; waiting?: number; needed?: number; guest?: boolean; owned?: string[] };

export interface OnlineLink {
  status(): OnlineStatus;
  subscribe(cb: () => void): () => void;
  queue(mode: ModeId, heroes: string[]): void;
  cancel(): void;
  session(): Session | null;
  close(): void;
}

const RESUME_KEY = "lifeos:arena:resume";
const GUEST_KEY = "lifeos:arena:guest";

export function arenaUrl(): string | null {
  const env = process.env.NEXT_PUBLIC_ARENA_URL;
  if (env) return env;
  if (typeof window !== "undefined" && (location.hostname === "localhost" || location.hostname === "127.0.0.1")) return `ws://${location.hostname}:8787`;
  return null;
}

export function connectArena(o: { name: string; token: string | null }): OnlineLink {
  const url = arenaUrl();
  let status: OnlineStatus = url ? { phase: "connecting" } : { phase: "error", message: "שרת המשחק המקוון לא הוגדר (NEXT_PUBLIC_ARENA_URL)." };
  const subs = new Set<() => void>();
  const emit = () => subs.forEach((f) => f());
  let ws: WebSocket | null = null;
  let sess: (Session & { _push(s: MatchState): void; _end(e: EndInfo): void }) | null = null;
  let closedByUser = false;
  let retries = 0;
  let you = "";

  const set = (s: Partial<OnlineStatus>) => {
    status = { ...status, ...s };
    emit();
  };
  const sendRaw = (m: unknown) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m));

  const open = () => {
    if (!url) return;
    ws = new WebSocket(url);
    ws.onopen = () => {
      retries = 0;
      let guestId: string | null = null;
      let resume: { matchId: string; key: string } | null = null;
      try {
        guestId = localStorage.getItem(GUEST_KEY);
        resume = JSON.parse(sessionStorage.getItem(RESUME_KEY) || "null");
      } catch {
        /* ignore */
      }
      sendRaw({ t: "hello", v: PROTOCOL_VERSION, name: o.name, token: o.token, guestId, resume });
    };
    ws.onmessage = (ev) => {
      const m = JSON.parse(String(ev.data)) as ServerMsg;
      if (m.t === "welcome") {
        you = m.playerId;
        try {
          if (m.guest) localStorage.setItem(GUEST_KEY, m.playerId);
        } catch {
          /* ignore */
        }
        set({ phase: sess ? "match" : "ready", guest: m.guest, owned: m.owned, message: undefined });
      } else if (m.t === "queued") set({ phase: "queued", waiting: m.waiting, needed: m.needed });
      else if (m.t === "match") {
        try {
          sessionStorage.setItem(RESUME_KEY, JSON.stringify({ matchId: m.matchId, key: m.key }));
        } catch {
          /* ignore */
        }
        if (!sess) sess = onlineSession(m.you, sendRaw);
        set({ phase: "match" });
      } else if (m.t === "snap") sess?._push(m.s);
      else if (m.t === "end") {
        try {
          sessionStorage.removeItem(RESUME_KEY);
        } catch {
          /* ignore */
        }
        sess?._end({ winner: m.winner, results: m.results, recorded: m.recorded, practice: false });
        set({ phase: "ready" });
      } else if (m.t === "error") set({ message: m.message, phase: status.phase === "queued" ? "ready" : status.phase });
      else if (m.t === "pong" && sess) sess.ping = Math.round(performance.now() - m.at);
    };
    ws.onclose = () => {
      if (closedByUser) return set({ phase: "closed" });
      // reconnect (the server keeps our place in a running match for 30 s)
      if (retries < 6) {
        retries++;
        set({ phase: sess ? "match" : "connecting", message: "החיבור נותק — מתחבר מחדש…" });
        setTimeout(open, 600 * retries);
      } else set({ phase: "error", message: "אין חיבור לשרת המשחק." });
    };
    ws.onerror = () => {
      /* onclose handles it */
    };
  };
  open();
  const pinger = setInterval(() => sendRaw({ t: "ping", at: performance.now() }), 2000);
  void you;

  return {
    status: () => status,
    subscribe: (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    queue: (mode, heroes) => sendRaw({ t: "queue", mode, heroes }),
    cancel: () => {
      sendRaw({ t: "cancel" });
      set({ phase: "ready" });
    },
    session: () => sess,
    close: () => {
      closedByUser = true;
      clearInterval(pinger);
      ws?.close();
    },
  };

  function onlineSession(me: string, out: (m: unknown) => void): Session & { _push(s: MatchState): void; _end(e: EndInfo): void } {
    let prev: MatchState | null = null;
    let cur: MatchState | null = null;
    let at = performance.now();
    let endCb: ((e: EndInfo) => void) | null = null;
    let ctl = { mx: 0, mz: 0, ax: 0, az: 1 };
    let lastSent = 0;
    let lastCtl = "";
    let queued: Partial<PlayerInput> = {};
    // ≤ ~30 messages/s (the server drops anything above 45/s); actions ride along with the next send
    const flush = () => {
      const now = performance.now();
      const k = `${ctl.mx.toFixed(2)},${ctl.mz.toFixed(2)},${ctl.ax.toFixed(1)},${ctl.az.toFixed(1)}`;
      const action = queued.cast != null || queued.switchTo != null;
      if (!action && k === lastCtl && now - lastSent < 250) return;
      if (now - lastSent < 33) return;
      lastSent = now;
      lastCtl = k;
      out({ t: "input", seq: nextSeq(), ...ctl, cast: queued.cast ?? null, switchTo: queued.switchTo ?? null });
      queued = {};
    };
    const s = {
      kind: "online" as const,
      you: me,
      frame: () => (cur ? { prev: prev ?? cur, cur, at } : null),
      control: (c: typeof ctl) => {
        ctl = c;
        flush();
      },
      cast: (slot: Slot) => {
        queued.cast = slot;
        flush();
      },
      switchTo: (i: number) => {
        queued.switchTo = i;
        flush();
      },
      leave: () => out({ t: "leave" }),
      onEnd: (cb: (e: EndInfo) => void) => (endCb = cb),
      dispose: () => undefined,
      _push: (st: MatchState) => {
        prev = cur;
        cur = st;
        at = performance.now();
      },
      _end: (e: EndInfo) => {
        endCb?.(e);
        sess = null;
      },
    };
    return s;
  }
}
