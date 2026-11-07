"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X, Play, Send, Loader2, ScrollText, PartyPopper, AlertTriangle, Info, Undo2 } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useUI } from "@/lib/store/ui";
import { useGameUI } from "@/lib/game/ui";
import { useNow } from "@/hooks/useToday";
import { briefing, dailyReport, weeklyReport, aiGameContext, type GmNote } from "@/lib/game/master";
import { instanceFromKey } from "@/lib/actions";
import { aiConfigured, buildContext, requestAIAnswer } from "@/lib/ai/client";
import { levelInfo, mainQuestInstance, profileOf, regionStates, totalXp } from "@/lib/game/engine";
import { challengesFor } from "@/lib/game/challenges";
import { remindersForDate } from "@/lib/reminders";
import { updateProfile } from "@/lib/game/actions";
import { cx } from "@/components/ui";
import { Avatar, GhostButton, GoldButton, XpBar } from "./bits";

const NOTE_ICON: Record<GmNote["tone"], typeof Info> = { celebrate: PartyPopper, warn: AlertTriangle, info: Info, return: Undo2 };
const NOTE_CLS: Record<GmNote["tone"], string> = { celebrate: "text-emerald-300", warn: "text-amber-300", info: "text-sky-300", return: "text-violet-300" };

function NoteAction({ n, onDone }: { n: GmNote; onDone: () => void }) {
  const db = useStore((s) => s.db);
  const a = n.action;
  if (!a) return null;
  if (a.kind === "link" && a.href)
    return (
      <Link href={a.href} onClick={onDone} className="text-[12px] font-semibold text-amber-200">
        {a.label}
      </Link>
    );
  return (
    <button
      className="text-[12px] font-semibold text-amber-200"
      onClick={() => {
        const inst = a.key ? instanceFromKey(db, a.key) : null;
        if (!inst) return;
        onDone();
        if (a.kind === "focus") useGameUI.getState().openFocus(inst.key);
        else if (a.kind === "reschedule") useUI.getState().openReschedule(inst);
      }}
    >
      {a.label}
    </button>
  );
}

export function GameMasterHost() {
  const open = useGameUI((s) => s.gmOpen);
  if (!open) return null;
  return <GameMasterSheet onClose={() => useGameUI.getState().setGmOpen(false)} />;
}

function GameMasterSheet({ onClose }: { onClose: () => void }) {
  const db = useStore((s) => s.db);
  const now = useNow();
  const b = useMemo(() => briefing(db, now.date), [db, now.date]);
  const [tab, setTab] = useState<"now" | "day" | "week">("now");
  const report = tab === "day" ? dailyReport(db, now.date) : tab === "week" ? weeklyReport(db, now.date) : null;
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<boolean | null>(null);
  useEffect(() => {
    void aiConfigured().then(setAi);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ask = async (question: string) => {
    if (question.trim().length < 2) return;
    setBusy(true);
    setAnswer(null);
    try {
      const ctx = { ...buildContext(db, now.date), game: aiGameContext(db, now.date).slice(0, 3000) };
      const r = await requestAIAnswer(question.trim(), ctx);
      setAnswer(r.answer);
    } catch (e) {
      setAnswer(e instanceof Error ? e.message : "לא הצלחתי לענות כרגע.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="מנהל המשחק">
      <div className="absolute inset-0 bg-[#05080f]/60 backdrop-blur-sm" onClick={onClose} />
      <div className="game-bg animate-sheet relative flex max-h-[90dvh] w-full flex-col rounded-t-3xl border border-amber-200/15 shadow-2xl sm:max-w-lg sm:rounded-3xl" data-testid="game-master">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <ScrollText size={18} className="gold-text" />
            <h2 className="font-semibold text-white">מנהל המשחק</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10" aria-label="סגירה">
            <X size={18} />
          </button>
        </div>
        <div className="flex gap-1 px-5 pt-3 text-sm">
          {(
            [
              ["now", "עכשיו"],
              ["day", "דוח יומי"],
              ["week", "דוח שבועי"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={cx("rounded-lg px-3 py-1.5", tab === k ? "bg-white/12 font-semibold text-white" : "text-slate-400 hover:text-slate-200")} aria-pressed={tab === k}>
              {l}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto px-5 py-4">
          {tab === "now" ? (
            <>
              <p className="text-lg font-semibold text-white">{b.greeting}</p>
              {b.next ? (
                <div className="glass-soft mt-3 rounded-xl p-3">
                  <div className="text-[11px] text-slate-400">המשימה הבאה · {b.nextWhy}</div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="font-medium text-white">{b.next.title}</span>
                    <GoldButton
                      className="px-3 py-1.5 text-xs"
                      onClick={() => {
                        onClose();
                        useGameUI.getState().openFocus(b.next!.key);
                      }}
                    >
                      <Play size={13} fill="currentColor" /> התחלה
                    </GoldButton>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-400">אין משימה פתוחה כרגע.</p>
              )}
              {b.notes.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {b.notes.map((n) => {
                    const I = NOTE_ICON[n.tone];
                    return (
                      <li key={n.id} className="flex items-start gap-2.5 text-sm">
                        <I size={16} className={cx("mt-0.5 shrink-0", NOTE_CLS[n.tone])} />
                        <div className="space-y-0.5">
                          <div className="text-slate-200">{n.text}</div>
                          <NoteAction n={n} onDone={onClose} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-3 text-[11px] text-slate-500">ההמלצות מחושבות מהנתונים שלך. שום שינוי לא נעשה בלי אישורך.</p>
            </>
          ) : (
            report && (
              <div data-testid="gm-report">
                <dl className="grid grid-cols-2 gap-2">
                  {report.rows.map((r) => (
                    <div key={r.label} className="glass-soft rounded-xl p-3">
                      <dt className="text-[11px] text-slate-400">{r.label}</dt>
                      <dd className="mt-0.5 text-lg font-bold text-white ltr-nums">{r.value}</dd>
                    </div>
                  ))}
                </dl>
                {report.lines.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 ps-5 text-sm text-slate-300">
                    {report.lines.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                )}
              </div>
            )
          )}
          {answer && <div className="glass-soft mt-4 whitespace-pre-wrap rounded-xl p-3 text-sm text-slate-100" data-testid="gm-answer">{answer}</div>}
        </div>
        <form
          className="flex gap-2 border-t border-white/10 px-5 py-3 pb-safe"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(q);
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            disabled={ai === false}
            placeholder={ai === false ? "שאלות חופשיות דורשות מפתח AI בשרת" : "לשאול את מנהל המשחק…"}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 disabled:opacity-60"
            maxLength={500}
          />
          <GhostButton type="submit" disabled={busy || ai === false || q.trim().length < 2} aria-label="שליחה">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </GhostButton>
        </form>
      </div>
    </div>
  );
}

/** Once-a-day welcome on the world screen: level, main quest, daily challenge, world progress, reminders. */
export function DailyIntro() {
  const db = useStore((s) => s.db);
  const ready = useStore((s) => s.status === "ready");
  const now = useNow();
  const profile = profileOf(db);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (ready && profile && profile.lastIntroDate !== now.date) setShow(true);
  }, [ready, profile, now.date]);
  if (!show || !profile) return null;
  const close = () => {
    setShow(false);
    void updateProfile({ lastIntroDate: now.date }, now.date);
  };
  const lvl = levelInfo(totalXp(db));
  const main = mainQuestInstance(db, now.date);
  const daily = challengesFor(db, now.date).find((c) => c.period === "daily");
  const stages = Object.values(regionStates(Object.values(db.xpEvents))).reduce((s, r) => s + r.stage, 0);
  const rems = remindersForDate(db, now.date)
    .filter((r) => r.at >= now.minutes)
    .slice(0, 3);
  const b = briefing(db, now.date);
  const settings = Object.values(db.settings)[0];
  if (settings && !settings.onboarded)
    return (
      <div className="fixed inset-0 z-[58] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="ברוך הבא" data-testid="daily-intro">
        <div className="absolute inset-0 bg-[#05080f]/70 backdrop-blur-sm" onClick={close} />
        <div className="game-bg animate-pop relative w-full max-w-sm rounded-3xl border border-amber-200/20 p-6 text-center shadow-2xl">
          <div className="text-[11px] uppercase tracking-[0.25em] text-amber-200/80">LifeOS</div>
          <h2 className="mt-2 text-2xl font-bold text-white">החיים שלך הם המשחק</h2>
          <p className="mt-2 text-sm text-slate-300">שישה אזורים מחכים לבנייה. כל משימה אמיתית שתשלים בונה אותם — בלי נקודות מזויפות.</p>
          <div className="mt-6 space-y-2">
            <Link href="/today" onClick={close} className="gold-btn flex w-full items-center justify-center rounded-xl py-3 text-sm font-bold">
              להגדרה הראשונה (דקה)
            </Link>
            <GhostButton className="w-full" onClick={close} data-testid="intro-close">
              לחקור את העולם
            </GhostButton>
          </div>
        </div>
      </div>
    );
  return (
    <div className="fixed inset-0 z-[58] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="פתיחת יום" data-testid="daily-intro">
      <div className="absolute inset-0 bg-[#05080f]/70 backdrop-blur-sm" onClick={close} />
      <div className="game-bg animate-pop relative w-full max-w-sm rounded-3xl border border-amber-200/20 p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <Avatar avatar={profile.avatar} size={52} level={lvl.level} />
          <div>
            <div className="text-xl font-bold text-white">{b.greeting}</div>
            <div className="text-[12px] text-slate-400">
              רמה <span className="ltr-nums">{lvl.level}</span> · <span className="ltr-nums">{lvl.into}/{lvl.need}</span> XP
            </div>
          </div>
        </div>
        <XpBar fraction={lvl.fraction} className="mt-3" />
        <dl className="mt-4 space-y-2.5 text-sm">
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-amber-200/80">המסע הראשי</dt>
            <dd className="text-white">{main ? main.title : "אין משימה פתוחה היום"}</dd>
          </div>
          {daily && (
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-amber-200/80">אתגר יומי</dt>
              <dd className="text-white">
                {daily.title} <span className="text-slate-400 ltr-nums">({daily.progress}/{daily.target})</span>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-amber-200/80">העולם</dt>
            <dd className="text-white">
              <span className="ltr-nums">{stages}</span> מתוך 30 ציוני דרך נבנו
            </dd>
          </div>
          {rems.length > 0 && (
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-amber-200/80">תזכורות קרובות</dt>
              <dd className="space-y-0.5 text-slate-200">
                {rems.map((r) => (
                  <div key={r.key}>
                    <span className="ltr-nums text-slate-400">{r.time}</span> {r.title}
                  </div>
                ))}
              </dd>
            </div>
          )}
        </dl>
        <div className="mt-6 space-y-2">
          {main && (
            <GoldButton
              className="w-full py-3"
              onClick={() => {
                close();
                useGameUI.getState().openFocus(main.key);
              }}
              data-testid="intro-start"
            >
              <Play size={16} fill="currentColor" /> START QUEST
            </GoldButton>
          )}
          <GhostButton className="w-full" onClick={close} data-testid="intro-close">
            לעולם שלי
          </GhostButton>
        </div>
      </div>
    </div>
  );
}

