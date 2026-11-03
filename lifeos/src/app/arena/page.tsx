"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Lock, Play, Wifi, X, Save, Trash2, Info, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { HERO_BY_ID, HEROES, RARITY_LABEL, REGION_NAME, ROLE_LABEL, ROLE_STATS, SLOT_LABEL } from "@/lib/arena/heroes";
import { MAPS, MODES, MODE_BY_ID } from "@/lib/arena/maps";
import { heroLevel, ownership } from "@/lib/arena/roster";
import { analyzeTeam } from "@/lib/arena/team";
import { connectArena, practiceSession, type EndInfo, type OnlineLink, type Session } from "@/lib/arena/session";
import type { BotLevel } from "@/lib/arena/bot";
import type { ModeId, Rarity } from "@/lib/arena/types";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { nowIso, uid } from "@/lib/actions";
import { formatHebDate } from "@/lib/dates";
import { cx, confirmDialog } from "@/components/ui";
import { GamePage, GhostButton, GoldButton, Panel } from "@/components/game/bits";
import { MatchView, ROLE_ICON } from "@/components/arena/MatchView";

const HeroPreview = dynamic(() => import("@/components/arena/HeroPreview"), { ssr: false });

const RARITY_CLS: Record<Rarity, string> = { common: "text-slate-300", rare: "text-sky-300", epic: "text-violet-300", legendary: "text-amber-300" };
const HISTORY_KEY = "lifeos:arena:history";

interface LocalHistory {
  id: string;
  mode: ModeId;
  mapId: string;
  won: boolean;
  draw: boolean;
  practice: boolean;
  at: string;
  recorded: boolean;
}

function readHistory(): LocalHistory[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

export default function ArenaPage() {
  const db = useStore((s) => s.db);
  const ledger = useMemo(() => Object.values(db.xpEvents ?? {}), [db.xpEvents]);
  const own = useMemo(() => ownership(ledger), [ledger]);
  const owned = own.filter((o) => o.owned).map((o) => o.hero.id);
  const profile = db.arenaProfile?.arena ?? null;
  const name = Object.values(db.settings)[0]?.displayName || db.gameProfile?.profile?.displayName || "חוקר";

  const [mode, setMode] = useState<ModeId>("duel");
  const [team, setTeam] = useState<string[]>(["aegis", "sage", "vita"]);
  const [slot, setSlot] = useState(0);
  const [inspect, setInspect] = useState<string | null>(null);
  const [level, setLevel] = useState<BotLevel>("normal");
  const [mapId, setMapId] = useState<string>("random");
  const [session, setSession] = useState<Session | null>(null);
  const [link, setLink] = useState<OnlineLink | null>(null);
  const [history, setHistory] = useState<LocalHistory[]>([]);
  useEffect(() => setHistory(readHistory()), []);
  useEffect(() => () => link?.close(), [link]);

  // keep the team valid if ownership changes
  useEffect(() => {
    setTeam((t) => {
      const ok = t.filter((h) => owned.includes(h));
      for (const h of owned) if (ok.length < 3 && !ok.includes(h)) ok.push(h);
      return ok.length === t.length && ok.every((h, i) => h === t[i]) ? t : ok;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owned.join(",")]);

  const report = analyzeTeam(team);
  const teamOk = team.length === 3 && new Set(team).size === 3;

  const pick = (id: string) => {
    if (!owned.includes(id)) return setInspect(id);
    setTeam((t) => {
      const n = [...t];
      const already = n.indexOf(id);
      if (already >= 0) [n[already], n[slot]] = [n[slot], n[already]];
      else n[slot] = id;
      return n;
    });
    setSlot((s) => (s + 1) % 3);
  };

  const startPractice = () => {
    const rnd = (role: string) => {
      const pool = HEROES.filter((h) => h.role === role);
      return pool[Math.floor(Math.random() * pool.length)].id;
    };
    const botTeams = Array.from({ length: 6 }, () => [rnd("tank"), rnd("damage"), rnd("support")]);
    const chosen = mapId === "random" ? MAPS[Math.floor(Math.random() * MAPS.length)].id : mapId;
    const t = Number(new URLSearchParams(location.search).get("t")) || undefined; // test hook: shorter practice
    setSession(practiceSession({ mode, mapId: chosen, heroes: team, name, level, botTeams, timeLimit: t }));
  };

  const goOnline = async () => {
    let l = link;
    if (!l) {
      let token: string | null = null;
      if (useStore.getState().mode === "supabase") token = (await getBrowserSupabase()?.auth.getSession())?.data.session?.access_token ?? null;
      l = connectArena({ name, token });
      setLink(l);
    }
    const unsub = l.subscribe(() => {
      const st = l!.status();
      if (st.phase === "ready" && !l!.session()) {
        unsub();
        l!.queue(mode, team);
      }
    });
    if (l.status().phase === "ready") {
      unsub();
      l.queue(mode, team);
    }
  };

  const onExit = (e: EndInfo) => {
    const me = e.results.find((r) => r.playerId === session?.you);
    const st = session?.frame()?.cur;
    if (st) {
      const h: LocalHistory = { id: st.id, mode: st.mode, mapId: st.mapId, won: !!me?.won, draw: !!me?.draw, practice: e.practice, at: nowIso(), recorded: e.recorded };
      const list = [h, ...readHistory().filter((x) => x.id !== h.id)].slice(0, 30);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
      } catch {
        /* ignore */
      }
      setHistory(list);
    }
    session?.dispose();
    setSession(null);
  };

  // open the match when the server starts one
  const onlineStatus = useSyncExternalStore(
    (cb) => (link ? link.subscribe(cb) : () => undefined),
    () => link?.status() ?? null,
    () => null,
  );
  useEffect(() => {
    if (link && onlineStatus?.phase === "match" && !session) {
      const s = link.session();
      if (s) setSession(s);
    }
  }, [link, onlineStatus, session]);

  if (session) return <MatchView session={session} onExit={onExit} />;

  const saved = Object.values(db.arenaTeams ?? {}).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const dbMatches = Object.values(db.arenaMatches ?? {}).sort((a, b) => (a.playedAt < b.playedAt ? 1 : -1));

  return (
    <GamePage title="זירת הגיבורים" subtitle="קרבות בזמן אמת, שלושה גיבורים לכל שחקן. הגיבורים נפתחים רק מהתקדמות אמיתית ב-LifeOS.">
      {/* modes */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-300">מצב משחק</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="מצב משחק">
          {MODES.map((m) => (
            <button key={m.id} role="radio" aria-checked={mode === m.id} onClick={() => setMode(m.id)} className={cx("glass-soft rounded-2xl p-3 text-start transition", mode === m.id ? "ring-2 ring-amber-300" : "hover:bg-white/[0.06]")}>
              <div className="font-semibold text-white">{m.name}</div>
              <div className="mt-0.5 text-[11px] text-slate-400">{m.desc}</div>
            </button>
          ))}
        </div>
        <Panel className="p-3 text-[12px] text-slate-300">
          <ul className="list-disc space-y-0.5 ps-4">
            {MODE_BY_ID[mode].rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
            <li>
              שחקנים: {MODE_BY_ID[mode].min === MODE_BY_ID[mode].max ? MODE_BY_ID[mode].min : `${MODE_BY_ID[mode].min}–${MODE_BY_ID[mode].max}`} · Hero XP במשחק מקוון: {MODE_BY_ID[mode].heroXp.play}+{MODE_BY_ID[mode].heroXp.win} לניצחון
            </li>
          </ul>
        </Panel>
      </section>

      {/* team */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-300">הצוות שלך</h2>
        <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
          <Panel className="p-3">
            <div className="grid grid-cols-3 gap-2" data-testid="team-slots">
              {[0, 1, 2].map((i) => {
                const d = HERO_BY_ID[team[i]];
                const Icon = d ? ROLE_ICON[d.role] : null;
                return (
                  <button key={i} onClick={() => setSlot(i)} className={cx("relative rounded-2xl border p-2.5 text-center", slot === i ? "border-amber-300 bg-amber-300/10" : "border-white/10 bg-white/[0.03]")} aria-label={`משבצת ${i + 1}${d ? `: ${d.name}` : ""}`}>
                    <div className="text-[10px] text-slate-400">{i === 0 ? "ראשי" : "תומך בהחלפה"}</div>
                    {d ? (
                      <>
                        <div className="mx-auto mt-1 flex h-10 w-10 items-center justify-center rounded-full" style={{ background: d.look.body, boxShadow: `0 0 0 2px ${d.look.trim}` }}>
                          {Icon && <Icon size={18} style={{ color: d.look.glow }} />}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-white">{d.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {ROLE_LABEL[d.role]} · {REGION_NAME[d.region]}
                        </div>
                      </>
                    ) : (
                      <div className="py-4 text-xs text-slate-500">בחירה</div>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">בוחרים משבצת ואז גיבור מהאוסף. הגיבור הראשי נכנס ראשון; מחליפים במשחק עם 1/2/3.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <GhostButton
                className="px-2.5 py-1 text-xs"
                disabled={!teamOk}
                onClick={() => {
                  const n = nowIso();
                  void useStore.getState().put("arenaTeams", { id: uid(), name: team.map((h) => HERO_BY_ID[h].name).join(" · "), heroes: team, createdAt: n, updatedAt: n });
                }}
              >
                <Save size={13} /> שמירת הצוות
              </GhostButton>
              {saved.map((s) => (
                <span key={s.id} className="flex items-center gap-1 rounded-xl bg-white/5 ps-2.5 text-xs">
                  <button onClick={() => s.heroes.every((h) => owned.includes(h)) && setTeam(s.heroes)} className="py-1 text-slate-200 hover:text-white">
                    {s.name}
                  </button>
                  <button
                    aria-label={`מחיקת ${s.name}`}
                    className="rounded-lg p-1 text-slate-500 hover:text-rose-300"
                    onClick={async () => (await confirmDialog({ title: "למחוק את הצוות השמור?", message: s.name, confirmLabel: "מחיקה", danger: true })) && void useStore.getState().remove("arenaTeams", s.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              ))}
            </div>
          </Panel>
          <Panel className="p-3 text-sm" data-testid="team-report">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold text-white ltr-nums">{report.hp}</div>
                <div className="text-[10px] text-slate-400">חיים בסך הכול</div>
              </div>
              <div>
                <div className="text-lg font-bold text-white ltr-nums">{report.sustain}/3</div>
                <div className="text-[10px] text-slate-400">ריפוי ומגן</div>
              </div>
              <div>
                <div className="text-lg font-bold text-white ltr-nums">{report.control}/3</div>
                <div className="text-[10px] text-slate-400">שליטה</div>
              </div>
            </div>
            <ul className="mt-2 space-y-1 text-[12px]">
              {report.notes.map((n) => (
                <li key={n.text} className={n.tone === "good" ? "text-emerald-300" : "text-amber-300"}>
                  {n.tone === "good" ? "✓" : "!"} {n.text}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-slate-500">בקרבות הנתונים מנורמלים לפי תפקיד: גיבור אגדי לא חזק יותר מגיבור רגיל — רק שונה.</p>
          </Panel>
        </div>
      </section>

      {/* play */}
      <section className="grid gap-3 sm:grid-cols-2">
        <Panel className="space-y-2 p-3">
          <div className="font-semibold text-white">אימון מול בוטים</div>
          <p className="text-[12px] text-slate-400">יריבים שמסומנים בבירור כ„בוט אימון”. רץ במכשיר שלך, בלי XP ובלי דירוג.</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <select value={level} onChange={(e) => setLevel(e.target.value as BotLevel)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-white" aria-label="רמת הבוט">
              <option value="easy">בוט קל</option>
              <option value="normal">בוט רגיל</option>
              <option value="hard">בוט קשה</option>
            </select>
            <select value={mapId} onChange={(e) => setMapId(e.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-white" aria-label="זירה">
              <option value="random">זירה אקראית</option>
              {MAPS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <GoldButton onClick={startPractice} disabled={!teamOk} className="w-full" data-testid="start-practice">
            <Play size={15} fill="currentColor" /> לאימון
          </GoldButton>
        </Panel>
        <Panel className="space-y-2 p-3" data-testid="online-panel">
          <div className="flex items-center gap-2 font-semibold text-white">
            <Wifi size={15} /> משחק מקוון
          </div>
          <p className="text-[12px] text-slate-400">שחקנים אמיתיים בלבד, שרת שמכריע כל פעולה. Hero XP ודירוג — רק כאן.</p>
          {onlineStatus?.phase === "queued" ? (
            <div className="flex items-center justify-between gap-2 text-sm text-slate-200" data-testid="queue-status">
              <span className="flex items-center gap-2">
                <Loader2 size={15} className="animate-spin" /> מחפש שחקנים… {onlineStatus.waiting}/{onlineStatus.needed}
              </span>
              <GhostButton className="px-2 py-1 text-xs" onClick={() => link?.cancel()}>
                ביטול
              </GhostButton>
            </div>
          ) : (
            <GoldButton onClick={() => void goOnline()} disabled={!teamOk || onlineStatus?.phase === "connecting"} className="w-full" data-testid="start-online">
              {onlineStatus?.phase === "connecting" ? <Loader2 size={15} className="animate-spin" /> : <Wifi size={15} />} חיפוש משחק
            </GoldButton>
          )}
          {onlineStatus?.message && <p className="text-[12px] text-amber-300" data-testid="online-message">{onlineStatus.message}</p>}
          {onlineStatus?.guest && <p className="text-[11px] text-slate-500">מחובר כאורח: אפשר רק את 3 הגיבורים ההתחלתיים, והתוצאות לא נשמרות. עם חשבון ענן השרת מאמת את הגיבורים שלך.</p>}
        </Panel>
      </section>

      {/* collection */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-300">
          האוסף <span className="text-slate-500 ltr-nums">({owned.length}/{HEROES.length})</span>
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" data-testid="collection">
          {own.map(({ hero: h, owned: has, detail }) => {
            const Icon = ROLE_ICON[h.role];
            const lvl = heroLevel(profile?.heroXp?.[h.id] ?? 0);
            const inTeam = team.includes(h.id);
            return (
              <div key={h.id} className={cx("glass-soft relative rounded-2xl p-2.5", inTeam && "ring-1 ring-amber-300/60", !has && "opacity-60")}>
                <button onClick={() => pick(h.id)} className="block w-full text-start" aria-label={has ? `בחירת ${h.name}` : `${h.name} — נעול`}>
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: h.look.body, boxShadow: `0 0 0 2px ${h.look.trim}` }}>
                      {has ? <Icon size={16} style={{ color: h.look.glow }} /> : <Lock size={14} className="text-slate-300" />}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{h.name}</div>
                      <div className={cx("text-[10px]", RARITY_CLS[h.rarity])}>
                        {RARITY_LABEL[h.rarity]} · {ROLE_LABEL[h.role]}
                      </div>
                    </div>
                  </div>
                  <div className="mt-1 truncate text-[10px] text-slate-500">{REGION_NAME[h.region]}</div>
                  {has ? <div className="text-[10px] text-slate-400 ltr-nums">רמת גיבור {lvl.level}</div> : <div className="line-clamp-2 text-[10px] text-amber-200/80">{detail}</div>}
                </button>
                <button onClick={() => setInspect(h.id)} className="absolute end-1.5 top-1.5 rounded-lg p-1 text-slate-500 hover:text-white" aria-label={`פרטים על ${h.name}`}>
                  <Info size={13} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* history */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-300">היסטוריית משחקים</h2>
        {dbMatches.length === 0 && history.length === 0 ? (
          <Panel className="text-sm text-slate-400">עוד לא שיחקת.</Panel>
        ) : (
          <ul className="space-y-1" data-testid="history">
            {dbMatches.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-sm">
                <span className="text-slate-200">
                  {MODE_BY_ID[m.mode as ModeId]?.name} · {MAPS.find((x) => x.id === m.mapId)?.name}
                </span>
                <span className={m.won ? "text-emerald-300" : "text-slate-400"}>{m.draw ? "תיקו" : m.won ? "ניצחון" : "הפסד"} · {formatHebDate(m.playedAt.slice(0, 10))}</span>
              </li>
            ))}
            {history
              .filter((h) => !dbMatches.some((m) => m.id === h.id))
              .map((h) => (
                <li key={h.id} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
                  <span className="text-slate-300">
                    {MODE_BY_ID[h.mode]?.name} · {MAPS.find((x) => x.id === h.mapId)?.name}
                    <span className="ms-2 text-[10px] text-slate-500">{h.practice ? "אימון" : h.recorded ? "מקוון" : "מקוון · לא נשמר בשרת"}</span>
                  </span>
                  <span className={h.won ? "text-emerald-300" : "text-slate-500"}>{h.draw ? "תיקו" : h.won ? "ניצחון" : "הפסד"}</span>
                </li>
              ))}
          </ul>
        )}
        {profile && (
          <p className="text-[12px] text-slate-400 ltr-nums">
            {profile.matches} משחקים מקוונים · {profile.wins} ניצחונות · דירוג דו־קרב {profile.rating?.duel ?? 1000}
          </p>
        )}
      </section>

      {inspect && <Inspect heroId={inspect} detail={own.find((o) => o.hero.id === inspect)!} xp={profile?.heroXp?.[inspect] ?? 0} onClose={() => setInspect(null)} />}
    </GamePage>
  );
}

function Inspect({ heroId, detail, xp, onClose }: { heroId: string; detail: ReturnType<typeof ownership>[number]; xp: number; onClose: () => void }) {
  const h = HERO_BY_ID[heroId];
  const lvl = heroLevel(xp);
  const stats = ROLE_STATS[h.role];
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={h.name} data-testid="inspect">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="game-bg animate-sheet relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-amber-200/15 sm:max-w-2xl sm:rounded-3xl">
        <button onClick={onClose} className="absolute end-3 top-3 z-10 rounded-lg p-1.5 text-slate-400 hover:bg-white/10" aria-label="סגירה">
          <X size={18} />
        </button>
        <div className="grid sm:grid-cols-[1fr_1.3fr]">
          <div className="h-64 sm:h-full" style={{ background: `radial-gradient(circle at 50% 60%, ${h.look.trim}33, transparent 70%)` }}>
            <HeroPreview heroId={heroId} />
          </div>
          <div className="p-4">
            <div className={cx("text-[11px]", RARITY_CLS[h.rarity])}>
              {RARITY_LABEL[h.rarity]} · {ROLE_LABEL[h.role]} · {REGION_NAME[h.region]}
            </div>
            <h2 className="text-2xl font-bold text-white">{h.name}</h2>
            <div className="text-sm text-slate-400">{h.title}</div>
            <p className="mt-2 text-sm text-slate-300">{h.story}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-white/5 p-2">
                <div className="font-bold text-white ltr-nums">{stats.hp}</div>
                <div className="text-slate-400">חיים</div>
              </div>
              <div className="rounded-xl bg-white/5 p-2">
                <div className="font-bold text-white ltr-nums">{stats.speed}</div>
                <div className="text-slate-400">מהירות</div>
              </div>
              <div className="rounded-xl bg-white/5 p-2">
                <div className="font-bold text-white ltr-nums">{lvl.level}</div>
                <div className="text-slate-400">רמת גיבור</div>
              </div>
            </div>
            <ul className="mt-3 space-y-2">
              {(["basic", "special", "defense", "ultimate"] as const).map((s) => {
                const a = h.abilities[s];
                return (
                  <li key={s} className="rounded-xl bg-white/[0.04] p-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-white">{a.name}</span>
                      <span className="text-[10px] text-slate-400">{SLOT_LABEL[s]}</span>
                    </div>
                    <div className="text-[12px] text-slate-300">{a.desc}</div>
                    <div className="mt-0.5 text-[10px] text-slate-500 ltr-nums" dir="rtl">
                      טעינה {a.cd} שנ׳{a.cost ? ` · ${a.cost} אנרגיה` : ""} · טווח {a.range} מ׳
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className={cx("mt-3 rounded-xl p-2.5 text-[12px]", detail.owned ? "bg-emerald-400/10 text-emerald-200" : "bg-amber-300/10 text-amber-100")}>
              {detail.owned ? `בבעלותך · ${detail.detail}` : `נעול · ${detail.detail}`}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">רמת גיבור עולה ב-Hero XP ממשחקים מקוונים בלבד, והיא קוסמטית — בקרב הנתונים מנורמלים.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
