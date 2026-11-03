"use client";
import Link from "next/link";
import { Check, Info } from "lucide-react";
import { useState } from "react";
import { useGame } from "@/lib/game/useGame";
import type { Challenge } from "@/lib/game/challenges";
import { formatHebDate } from "@/lib/dates";
import { cx } from "@/components/ui";
import { GamePage, Panel, XpBar } from "@/components/game/bits";

const PERIODS: Array<{ id: Challenge["period"]; title: string }> = [
  { id: "daily", title: "יומיים" },
  { id: "weekly", title: "שבועיים" },
  { id: "special", title: "מיוחדים" },
  { id: "season", title: "עונתיים" },
  { id: "personal", title: "אישיים" },
];

export default function ChallengesPage() {
  const g = useGame();
  const history = g.ledger
    .filter((e) => e.kind === "challenge")
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 20);
  return (
    <GamePage title="אתגרים" subtitle="נבנים מהתוכנית האמיתית שלך — בגודל שאפשר לעמוד בו.">
      {g.challenges.length === 0 ? (
        <Panel className="py-8 text-center text-slate-300">
          אין כרגע אתגרים — הם נוצרים מהמשימות המתוכננות שלך.{" "}
          <Link href="/today" className="font-semibold text-amber-200">
            לתכנון היום
          </Link>
        </Panel>
      ) : (
        PERIODS.map((p) => {
          const list = g.challenges.filter((c) => c.period === p.id);
          if (!list.length) return null;
          return (
            <section key={p.id} className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-300">{p.title}</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {list.map((c) => (
                  <ChallengeCard key={c.id} c={c} />
                ))}
              </div>
            </section>
          );
        })
      )}
      <SeasonCard season={g.season} />
      {history.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-300">הושלמו לאחרונה</h2>
          <ul className="space-y-1">
            {history.map((e) => (
              <li key={e.id} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
                <span className="text-slate-200">{e.title}</span>
                <span className="text-[12px] text-slate-500">
                  <span className="gold-text ltr-nums">+{e.amount}</span> · {formatHebDate(e.at.slice(0, 10))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </GamePage>
  );
}

function SeasonCard({ season }: { season: ReturnType<typeof useGame>["season"] }) {
  return (
    <Panel className="flex items-center justify-between gap-3">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-amber-200/80">עונה {season.index}</div>
        <div className="font-semibold text-white">{season.theme}</div>
        <div className="text-[12px] text-slate-400">
          {formatHebDate(season.start)} – {formatHebDate(season.end)}
        </div>
      </div>
      <div className="w-32 text-end">
        <div className="text-[12px] text-slate-400 ltr-nums">יום {season.day}/90</div>
        <XpBar fraction={season.fraction} thin className="mt-1" />
      </div>
    </Panel>
  );
}

function ChallengeCard({ c }: { c: Challenge }) {
  const [why, setWhy] = useState(false);
  return (
    <Panel className={cx("p-3.5", c.done && "ring-1 ring-emerald-400/30")} data-testid="challenge">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-white">{c.title}</div>
          <div className="mt-0.5 text-[12px] text-slate-400">
            <span className="gold-text font-semibold ltr-nums">+{c.xp} XP</span>
            <button onClick={() => setWhy((w) => !w)} className="ms-2 inline-flex items-center gap-0.5 text-slate-500 hover:text-slate-300" aria-expanded={why}>
              <Info size={12} /> למה
            </button>
          </div>
          {why && <div className="mt-1 text-[12px] text-slate-400">{c.why}</div>}
        </div>
        {c.done ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400 text-stone-900">
            <Check size={15} strokeWidth={3} />
          </span>
        ) : (
          <span className="text-sm text-slate-300 ltr-nums">
            {c.progress}/{c.target}
          </span>
        )}
      </div>
      <XpBar fraction={c.progress / c.target} thin className="mt-2.5" />
    </Panel>
  );
}
