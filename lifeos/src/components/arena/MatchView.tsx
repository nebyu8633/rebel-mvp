"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { LogOut, Crown, Shield, Swords, HeartPulse, Wifi, WifiOff } from "lucide-react";
import { HERO_BY_ID, MAX_ENERGY, ROLE_LABEL, SLOT_LABEL, SWITCH_CD } from "@/lib/arena/heroes";
import { MODE_BY_ID } from "@/lib/arena/maps";
import type { EndInfo, Session } from "@/lib/arena/session";
import type { MatchState, Player, Role, Slot } from "@/lib/arena/types";
import { cx } from "@/components/ui";
import { TEAM_COLORS, type Aim } from "./colors";

const Arena3D = dynamic(() => import("./Arena3D"), { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-sm text-slate-300">טוען זירה…</div> });

const KEYS: Record<Slot, string> = { basic: "קליק", special: "Q", defense: "E", ultimate: "R" };
export const ROLE_ICON: Record<Role, typeof Shield> = { tank: Shield, damage: Swords, support: HeartPulse };

/** HUD refresh at 10 Hz (the practice engine mutates one state object, so re-render by tick). */
function useHud(session: Session) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 100);
    return () => clearInterval(t);
  }, [session]);
  return session.frame()?.cur ?? null;
}

const fmtTime = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, "0")}`;

export function MatchView({ session, onExit, teamNames }: { session: Session; onExit: (e: EndInfo) => void; teamNames?: string[] }) {
  const st = useHud(session);
  const aim = useRef<Aim>({ x: 0, z: 0, fromPointer: false });
  const keys = useRef(new Set<string>());
  const firing = useRef(false);
  const joy = useRef({ x: 0, z: 0, active: false });
  const lastPointer = useRef(0);
  const [touch, setTouch] = useState(false);
  const [lowPower, setLowPower] = useState(false);
  const [ended, setEnded] = useState<EndInfo | null>(null);

  useEffect(() => {
    setTouch(window.matchMedia("(pointer: coarse)").matches || (navigator.maxTouchPoints > 0 && !window.matchMedia("(hover: hover)").matches));
    const n = navigator as Navigator & { deviceMemory?: number };
    setLowPower((n.hardwareConcurrency ?? 8) <= 4 || (n.deviceMemory ?? 8) <= 4);
    session.onEnd((e) => setEnded(e));
  }, [session]);

  // keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const code = e.code;
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(code)) e.preventDefault();
      keys.current.add(code);
      if (code === "KeyQ") session.cast("special");
      else if (code === "KeyE" || code === "Space") session.cast("defense");
      else if (code === "KeyR") session.cast("ultimate");
      else if (code === "KeyJ") firing.current = true;
      else if (code === "Digit1") session.switchTo(0);
      else if (code === "Digit2") session.switchTo(1);
      else if (code === "Digit3") session.switchTo(2);
    };
    const up = (e: KeyboardEvent) => {
      keys.current.delete(e.code);
      if (e.code === "KeyJ") firing.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [session]);

  // control loop: movement + aim every frame
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const k = keys.current;
      const has = (...a: string[]) => a.some((x) => k.has(x));
      // physical key positions (works with a Hebrew layout too). Camera looks "north" = -z.
      let mx = (has("KeyD", "ArrowRight") ? 1 : 0) - (has("KeyA", "ArrowLeft") ? 1 : 0);
      let mz = (has("KeyS", "ArrowDown") ? 1 : 0) - (has("KeyW", "ArrowUp") ? 1 : 0);
      if (joy.current.active) {
        mx = joy.current.x;
        mz = joy.current.z;
      }
      const l = Math.hypot(mx, mz);
      if (l > 1) {
        mx /= l;
        mz /= l;
      }
      const f = session.frame();
      const me = f?.cur.players.find((p) => p.id === session.you);
      let ax = aim.current.x;
      let az = aim.current.z;
      const pointerFresh = aim.current.fromPointer && performance.now() - lastPointer.current < 4000;
      if (me && (!pointerFresh || touch)) {
        // auto-aim: nearest enemy in reach, else where we're heading
        const foes = f!.cur.players.filter((p) => p.team !== me.team && !p.eliminated && p.respawn <= 0 && p.heroes[p.active]?.alive);
        const near = foes.sort((a, b) => Math.hypot(a.pos.x - me.pos.x, a.pos.z - me.pos.z) - Math.hypot(b.pos.x - me.pos.x, b.pos.z - me.pos.z))[0];
        if (near && Math.hypot(near.pos.x - me.pos.x, near.pos.z - me.pos.z) < 15) {
          ax = near.pos.x;
          az = near.pos.z;
        } else if (Math.hypot(mx, mz) > 0.1) {
          ax = me.pos.x + mx * 6;
          az = me.pos.z + mz * 6;
        } else {
          ax = me.pos.x + Math.sin(me.facing) * 6;
          az = me.pos.z + Math.cos(me.facing) * 6;
        }
      }
      session.control({ mx, mz, ax, az });
      if (firing.current) session.cast("basic");
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [session, touch]);

  const me = st?.players.find((p) => p.id === session.you) ?? null;
  const mode = st ? MODE_BY_ID[st.mode] : null;

  return (
    <div
      className="fixed inset-0 z-[80] select-none overflow-hidden bg-[#05080f] text-white"
      dir="rtl"
      data-testid="match-view"
      data-phase={st?.phase ?? "loading"}
      data-pos={me ? `${me.pos.x.toFixed(2)},${me.pos.z.toFixed(2)}` : ""}
      data-active={me ? me.heroes[me.active].heroId : ""}
      style={{ touchAction: "none" }}
    >
      <div
        className="absolute inset-0"
        onPointerMove={(e) => {
          if (e.pointerType === "mouse") lastPointer.current = performance.now();
        }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button === 0) {
            lastPointer.current = performance.now();
            firing.current = true;
          }
        }}
        onPointerUp={(e) => {
          if (e.pointerType === "mouse") firing.current = false;
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Arena3D session={session} aim={aim} lowPower={lowPower} />
      </div>

      {st && mode && (
        <>
          {/* top: score, time, objectives */}
          <div className="pointer-events-none absolute inset-x-0 top-2 flex flex-col items-center gap-1.5 px-2">
            <div className="glass pointer-events-auto flex items-center gap-3 rounded-2xl px-3 py-1.5" data-testid="scoreboard">
              <Score st={st} youTeam={me?.team ?? 0} teamNames={teamNames} />
              <span className="ltr-nums text-lg font-bold tabular-nums" data-testid="match-time">
                {fmtTime(st.timeLimit - st.time)}
              </span>
            </div>
            {st.mode === "crystal" && (
              <div className="flex gap-1.5" data-testid="objectives">
                {st.crystals.map((c) => (
                  <span key={c.id} className="glass flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]">
                    <span className="h-2.5 w-2.5 rotate-45" style={{ background: c.owner == null ? "#bbb" : TEAM_COLORS[c.owner] }} />
                    {c.owner == null ? (Math.abs(c.progress) > 0.05 ? `${Math.round(Math.abs(c.progress) * 100)}%` : "פנוי") : c.owner === me?.team ? "שלנו" : "של היריב"}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="absolute end-2 top-2 flex flex-col items-end gap-1.5">
            <button onClick={() => (st.phase === "ended" ? undefined : session.leave())} className="glass flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs" aria-label="יציאה מהמשחק">
              <LogOut size={14} /> יציאה
            </button>
            {session.kind === "online" && (
              <span className="glass flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] text-slate-300 ltr-nums">
                <Wifi size={11} /> {session.ping ?? "–"}ms
              </span>
            )}
          </div>

          {/* intro + countdown */}
          {st.phase === "countdown" && <Intro st={st} you={session.you} />}
          {me && !me.eliminated && me.respawn > 0 && <Banner text={`חוזרים לזירה בעוד ${Math.ceil(me.respawn)}`} />}
          {me?.eliminated && st.phase !== "ended" && <Banner text="כל הגיבורים שלך הופלו — צופה בקרב" />}
          {st.players.some((p) => !p.connected && !p.eliminated) && (
            <div className="glass absolute start-2 top-14 flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-amber-200">
              <WifiOff size={12} /> שחקן התנתק — מחכים לו עד 30 שניות
            </div>
          )}

          {/* bottom: heroes + abilities */}
          {me && <Controls me={me} session={session} touch={touch} joy={joy} firing={firing} />}
        </>
      )}

      {ended && <Results end={ended} you={session.you} st={st} onClose={() => onExit(ended)} />}
    </div>
  );
}

function Score({ st, youTeam, teamNames }: { st: MatchState; youTeam: number; teamNames?: string[] }) {
  const mode = MODE_BY_ID[st.mode];
  if (mode.target == null)
    return (
      <span className="flex items-center gap-2 text-sm">
        {st.players.map((p) => (
          <span key={p.id} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: TEAM_COLORS[p.team] }} />
            {p.heroes.filter((h) => h.alive).length}/3
          </span>
        ))}
      </span>
    );
  if (mode.teams === 2)
    return (
      <span className="flex items-center gap-2 text-sm font-bold ltr-nums">
        <span style={{ color: TEAM_COLORS[0] }}>{Math.floor(st.score[0])}</span>
        <span className="text-[11px] font-normal text-slate-400">{teamNames?.[youTeam] ?? (youTeam === 0 ? "הצוות שלך כחול" : "הצוות שלך אדום")}</span>
        <span style={{ color: TEAM_COLORS[1] }}>{Math.floor(st.score[1])}</span>
        <span className="text-[10px] font-normal text-slate-500">/ {mode.target}</span>
      </span>
    );
  const top = st.players.map((p) => ({ p, s: st.score[p.team] })).sort((a, b) => b.s - a.s).slice(0, 4);
  return (
    <span className="flex items-center gap-2 text-xs ltr-nums">
      {top.map(({ p, s }) => (
        <span key={p.id} className={cx("flex items-center gap-1", p.team === youTeam && "font-bold text-amber-200")}>
          <span className="h-2 w-2 rounded-full" style={{ background: TEAM_COLORS[p.team % TEAM_COLORS.length] }} />
          {s}
        </span>
      ))}
      <span className="text-[10px] text-slate-500">/ {mode.target}</span>
    </span>
  );
}

function Banner({ text }: { text: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center">
      <div className="glass animate-pop rounded-2xl px-5 py-2.5 text-base font-semibold">{text}</div>
    </div>
  );
}

function Intro({ st, you }: { st: MatchState; you: string }) {
  const mode = MODE_BY_ID[st.mode];
  const teams = mode.teams === 2 ? [0, 1] : st.players.map((p) => p.team);
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/40" data-testid="intro">
      <div className="text-xs uppercase tracking-[0.3em] text-amber-200">{mode.name}</div>
      <div className="flex flex-wrap items-center justify-center gap-4 px-4">
        {teams.map((t, i) => (
          <div key={t} className="flex items-center gap-4">
            {i > 0 && <span className="gold-text text-2xl font-black italic">VS</span>}
            <div className="glass animate-pop rounded-2xl px-3 py-2 text-sm" style={{ borderColor: TEAM_COLORS[t % TEAM_COLORS.length] }}>
              {st.players
                .filter((p) => p.team === t)
                .map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="font-semibold">{p.id === you ? "אתה" : p.name}</span>
                    {p.kind === "bot" && <span className="rounded bg-white/10 px-1 text-[10px] text-slate-300">בוט אימון</span>}
                    <span className="text-[11px] text-slate-400">{p.heroes.map((h) => HERO_BY_ID[h.heroId].name).join(" · ")}</span>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
      <div key={Math.ceil(st.countdown)} className="animate-pop text-6xl font-black text-white drop-shadow-lg ltr-nums">
        {Math.max(1, Math.ceil(st.countdown))}
      </div>
    </div>
  );
}

function Controls({ me, session, touch, joy, firing }: { me: Player; session: Session; touch: boolean; joy: React.MutableRefObject<{ x: number; z: number; active: boolean }>; firing: React.MutableRefObject<boolean> }) {
  const h = me.heroes[me.active];
  const def = HERO_BY_ID[h.heroId];
  return (
    <>
      {/* hero slots */}
      <div className={cx("absolute flex gap-2", touch ? "inset-x-0 top-14 justify-center" : "bottom-3 left-1/2 -translate-x-1/2")} data-testid="hero-slots">
        {me.heroes.map((x, i) => {
          const d = HERO_BY_ID[x.heroId];
          const Icon = ROLE_ICON[d.role];
          const act = i === me.active;
          return (
            <button
              key={x.heroId}
              onClick={() => session.switchTo(i)}
              disabled={!x.alive}
              aria-label={`החלפה ל${d.name}`}
              className={cx("glass relative flex w-20 flex-col items-center rounded-xl px-1.5 py-1 text-[11px] transition-transform", act ? "scale-105 ring-2 ring-amber-300" : "opacity-90", !x.alive && "opacity-35 grayscale")}
            >
              <span className="flex items-center gap-1 font-semibold">
                <Icon size={12} style={{ color: d.look.glow }} /> {d.name}
              </span>
              <span className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/50">
                <span className="block h-full bg-emerald-400" style={{ width: `${(Math.max(0, x.hp) / x.maxHp) * 100}%` }} />
              </span>
              <span className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-black/50">
                <span className="block h-full bg-sky-400" style={{ width: `${(x.energy / MAX_ENERGY) * 100}%` }} />
              </span>
              {!touch && <span className="absolute -top-2 start-1 rounded bg-black/70 px-1 text-[9px] ltr-nums">{i + 1}</span>}
              {!act && x.alive && me.switchCd > 0 && <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 text-xs font-bold ltr-nums">{me.switchCd.toFixed(1)}</span>}
            </button>
          );
        })}
      </div>

      {/* active hero vitals (desktop) */}
      {!touch && (
        <div className="glass absolute bottom-3 left-3 w-56 rounded-2xl p-2.5" data-testid="active-hero">
          <div className="flex items-baseline justify-between">
            <span className="font-bold">{def.name}</span>
            <span className="text-[11px] text-slate-400">{ROLE_LABEL[def.role]}</span>
          </div>
          <Bar v={h.hp / h.maxHp} color="#5ee08a" label={`${Math.max(0, Math.round(h.hp))}/${h.maxHp}${h.shield > 0 ? ` +${Math.round(h.shield)}` : ""}`} />
          <Bar v={h.energy / MAX_ENERGY} color="#4aa3ff" label={`אנרגיה ${Math.round(h.energy)}`} />
          {h.statuses.length > 0 && <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-300">{h.statuses.map((s) => <span key={s.type} className="rounded bg-white/10 px-1">{STATUS_LABEL[s.type]}</span>)}</div>}
        </div>
      )}

      {/* abilities */}
      <div className={cx("absolute flex", touch ? "bottom-5 right-4 flex-col-reverse items-end gap-2" : "bottom-3 right-3 gap-2")} dir="ltr" data-testid="abilities">
        {(touch ? (["basic", "special", "defense", "ultimate"] as Slot[]) : (["basic", "special", "defense", "ultimate"] as Slot[])).map((slot) => {
          const ab = def.abilities[slot];
          const cd = h.cds[slot];
          const noEnergy = h.energy < ab.cost;
          const big = touch && slot === "basic";
          return (
            <button
              key={slot}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (slot === "basic") firing.current = true;
                else session.cast(slot);
              }}
              onPointerUp={() => slot === "basic" && (firing.current = false)}
              onPointerLeave={() => slot === "basic" && (firing.current = false)}
              aria-label={`${SLOT_LABEL[slot]}: ${ab.name}`}
              title={`${ab.name} — ${ab.desc}`}
              className={cx("glass relative flex flex-col items-center justify-center overflow-hidden rounded-2xl text-center", big ? "h-20 w-20" : touch ? "h-14 w-14" : "h-16 w-20", (cd > 0 || noEnergy) && "opacity-70")}
              data-testid={`ability-${slot}`}
            >
              {cd > 0 && <span className="absolute inset-0 bg-black/55" style={{ clipPath: `inset(${(1 - cd / ab.cd) * 100}% 0 0 0)` }} />}
              <span className="relative text-[10px] leading-tight" dir="rtl">
                {ab.name}
              </span>
              {cd > 0 ? <span className="relative text-sm font-bold ltr-nums">{cd.toFixed(cd < 1 ? 1 : 0)}</span> : !touch && <span className="relative text-[9px] text-slate-400">{KEYS[slot]}</span>}
              {ab.cost > 0 && <span className={cx("relative text-[9px] ltr-nums", noEnergy ? "text-rose-300" : "text-sky-300")}>{ab.cost}⚡</span>}
            </button>
          );
        })}
      </div>

      {touch && <Joystick joy={joy} />}
      {!touch && <div className="pointer-events-none absolute bottom-[5.5rem] right-3 text-[10px] text-slate-500">WASD · עכבר לכיוון · קליק/Q/E/R · 1–3 החלפה · החלפה כל {SWITCH_CD} שנ׳</div>}
    </>
  );
}

const STATUS_LABEL = { slow: "מואט", stun: "מושהה", silence: "מושתק", haste: "מהיר", power: "מחוזק", mark: "מסומן", guard: "מוגן" } as const;

function Bar({ v, color, label }: { v: number; color: string; label: string }) {
  return (
    <div className="mt-1.5">
      <div className="relative h-3 overflow-hidden rounded-full bg-black/50">
        <div className="h-full transition-[width] duration-150" style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%`, background: color }} />
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold ltr-nums">{label}</span>
      </div>
    </div>
  );
}

/** Virtual joystick (bottom-left), for touch screens. */
function Joystick({ joy }: { joy: React.MutableRefObject<{ x: number; z: number; active: boolean }> }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const id = useRef<number | null>(null);
  const move = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const max = r.width / 2;
    const l = Math.hypot(dx, dy);
    if (l > max) {
      dx = (dx / l) * max;
      dy = (dy / l) * max;
    }
    setKnob({ x: dx, y: dy });
    joy.current = { x: dx / max, z: dy / max, active: true };
  };
  return (
    <div
      ref={base}
      className="absolute bottom-6 left-5 h-32 w-32 rounded-full border border-white/20 bg-white/5"
      data-testid="joystick"
      onPointerDown={(e) => {
        id.current = e.pointerId;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={(e) => id.current === e.pointerId && move(e)}
      onPointerUp={() => {
        id.current = null;
        setKnob({ x: 0, y: 0 });
        joy.current = { x: 0, z: 0, active: false };
      }}
    >
      <div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/25 shadow-lg" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
    </div>
  );
}

function Results({ end, you, st, onClose }: { end: EndInfo; you: string; st: MatchState | null; onClose: () => void }) {
  const mine = end.results.find((r) => r.playerId === you);
  const title = mine?.draw ? "תיקו" : mine?.won ? "ניצחון!" : "הפסד";
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-4" data-testid="results">
      <div className="game-bg animate-pop w-full max-w-lg rounded-3xl border border-amber-200/20 p-5">
        <div className="text-center">
          {mine?.won && <Crown className="gold-text mx-auto mb-1" size={36} />}
          <div className={cx("text-3xl font-black", mine?.won ? "gold-text" : "text-white")}>{title}</div>
          <div className="mt-1 text-sm text-slate-400">{end.winner?.reason}</div>
        </div>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-[11px] text-slate-400">
              <th className="py-1 text-start font-medium">שחקן</th>
              <th className="font-medium">נזק</th>
              <th className="font-medium">ריפוי</th>
              <th className="font-medium">הפלות</th>
              <th className="font-medium">נפילות</th>
            </tr>
          </thead>
          <tbody>
            {end.results.map((r) => (
              <tr key={r.playerId} className={cx("border-t border-white/10", r.playerId === you && "text-amber-100")}>
                <td className="py-1.5">
                  <span className="me-1 inline-block h-2 w-2 rounded-full" style={{ background: TEAM_COLORS[r.team % TEAM_COLORS.length] }} />
                  {r.playerId === you ? "אתה" : r.name}
                  {st?.players.find((p) => p.id === r.playerId)?.kind === "bot" && <span className="ms-1 text-[10px] text-slate-500">(בוט)</span>}
                  {r.won && " 🏆"}
                </td>
                <td className="text-center ltr-nums">{r.stats.damage}</td>
                <td className="text-center ltr-nums">{r.stats.healing}</td>
                <td className="text-center ltr-nums">{r.stats.kos}</td>
                <td className="text-center ltr-nums">{r.stats.downs}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 rounded-xl bg-white/5 p-3 text-sm" data-testid="rewards">
          {end.practice ? (
            <p className="text-slate-300">משחק אימון מול בוטים — בלי Hero XP ובלי דירוג. Life XP מגיע רק ממשימות אמיתיות.</p>
          ) : mine ? (
            <>
              <div className="flex flex-wrap gap-2">
                {Object.entries(mine.heroXp).map(([h, x]) => (
                  <span key={h} className="rounded-full bg-amber-300/15 px-2 py-0.5 text-amber-100">
                    {HERO_BY_ID[h]?.name}: +{x} Hero XP
                  </span>
                ))}
              </div>
              {mine.ratingAfter != null && mine.ratingBefore != null && (
                <p className="mt-2 text-slate-300 ltr-nums">
                  דירוג: {mine.ratingBefore} → {mine.ratingAfter} ({mine.ratingAfter - mine.ratingBefore >= 0 ? "+" : ""}
                  {mine.ratingAfter - mine.ratingBefore})
                </p>
              )}
              <p className="mt-2 text-[11px] text-slate-500">{end.recorded ? "התוצאה חושבה ונשמרה בשרת." : "התוצאה חושבה בשרת אבל לא נשמרה (משחק כאורח, בלי חשבון ענן)."} משחקי זירה לא נותנים Life XP ולא פותחים גיבורים.</p>
            </>
          ) : null}
        </div>
        <button onClick={onClose} className="gold-btn mt-4 w-full rounded-xl py-2.5 text-sm font-bold" data-testid="results-close">
          חזרה ללובי
        </button>
      </div>
    </div>
  );
}
