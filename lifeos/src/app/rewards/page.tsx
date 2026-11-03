"use client";
import { useState } from "react";
import { Gift, Lock, Trash2, Plus, Check, Trophy } from "lucide-react";
import { useGame } from "@/lib/game/useGame";
import { claimReward, deleteReward, openChest, saveReward } from "@/lib/game/actions";
import { formatHebDate } from "@/lib/dates";
import { REGIONS } from "@/lib/game/regions";
import type { DB, Reward } from "@/lib/types";
import { confirmDialog, cx } from "@/components/ui";
import { GamePage, GhostButton, GoldButton, Panel } from "@/components/game/bits";

const DECOR_LABEL: Record<string, string> = {
  lantern: "פנס הכיכר",
  banner: "דגל ההתמדה",
  statue: "פסל אבני הדרך",
  compass: "מצפן החוקר",
  beacon: "משואת העקביות",
  fountain: "מזרקת המטרות",
  citadel: "חומות המצודה",
};

function conditionMet(db: DB, r: Reward, level: number) {
  const c = r.condition;
  if (c.type === "level") return level >= c.level;
  if (c.type === "milestone") return db.milestones[c.refId]?.status === "done";
  return db.goals[c.refId]?.status === "done";
}
function conditionLabel(db: DB, r: Reward) {
  const c = r.condition;
  if (c.type === "level") return `בהגעה לרמה ${c.level}`;
  if (c.type === "milestone") return `בהשלמת: ${db.milestones[c.refId]?.title ?? "אבן דרך שנמחקה"}`;
  return `בהשגת: ${db.goals[c.refId]?.title ?? "מטרה שנמחקה"}`;
}

export default function RewardsPage() {
  const g = useGame();
  const chests = Object.values(g.db.milestones)
    .filter((m) => m.status === "done")
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  const opened = new Set(g.profile?.chestsOpened ?? []);
  const trophies = g.ledger.filter((e) => e.kind === "goal");
  const special = REGIONS.filter((r) => g.regions[r.id].stage === 5);
  const rewards = Object.values(g.db.rewards).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const [adding, setAdding] = useState(false);

  return (
    <GamePage title="פרסים" subtitle="כל פרס כאן הושג בפעילות אמיתית. בלי הגרלות.">
      <section id="chests" className="scroll-mt-20 space-y-2">
        <h2 className="text-sm font-semibold text-slate-300">תיבות אוצר</h2>
        {chests.length === 0 ? (
          <Panel className="text-sm text-slate-400">כל אבן דרך שתושלם תעניק תיבת אוצר (‎+20 XP).</Panel>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {chests.map((m) => {
              const isOpen = opened.has(m.id);
              return (
                <Panel key={m.id} className={cx("flex flex-col items-center p-3 text-center", !isOpen && "ring-1 ring-amber-300/40")}>
                  <span className={cx("text-3xl", isOpen && "opacity-50")}>{isOpen ? "📭" : "🎁"}</span>
                  <div className="mt-1 line-clamp-2 text-[12px] text-slate-300">{m.title}</div>
                  {isOpen ? (
                    <div className="mt-1.5 text-[11px] text-slate-500">נפתחה · ‎+20 XP</div>
                  ) : (
                    <GoldButton onClick={() => void openChest(m.id, g.today)} className="mt-2 px-3 py-1 text-[12px]" data-testid="open-chest">
                      פתיחה · ‎+20 XP
                    </GoldButton>
                  )}
                </Panel>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300">פרסים מהחיים האמיתיים</h2>
          {!adding && (
            <GhostButton onClick={() => setAdding(true)} className="px-2.5 py-1 text-[12px]">
              <Plus size={14} /> פרס חדש
            </GhostButton>
          )}
        </div>
        {adding && <RewardForm db={g.db} onDone={() => setAdding(false)} />}
        {rewards.length === 0 && !adding ? (
          <Panel className="text-sm text-slate-400">הגדר פרס אמיתי לעצמך — למשל ארוחה טובה כשמסיימים אבן דרך.</Panel>
        ) : (
          <ul className="space-y-1.5">
            {rewards.map((r) => {
              const met = conditionMet(g.db, r, g.level.level);
              return (
                <li key={r.id} className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5">
                  <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", r.claimedAt ? "bg-emerald-400 text-stone-900" : met ? "gold-btn" : "bg-white/10 text-slate-500")}>
                    {r.claimedAt ? <Check size={15} strokeWidth={3} /> : met ? <Gift size={15} /> : <Lock size={13} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white">{r.title}</div>
                    <div className="text-[11px] text-slate-400">{r.claimedAt ? `מומש ב-${formatHebDate(r.claimedAt.slice(0, 10))}` : conditionLabel(g.db, r)}</div>
                  </div>
                  {met && (
                    <GhostButton onClick={() => void claimReward(r)} className="px-2.5 py-1 text-[12px]">
                      {r.claimedAt ? "ביטול מימוש" : "מימשתי"}
                    </GhostButton>
                  )}
                  <button
                    aria-label={`מחיקת ${r.title}`}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-white/10 hover:text-rose-300"
                    onClick={async () => {
                      if (await confirmDialog({ title: "למחוק את הפרס?", message: r.title, confirmLabel: "מחיקה", danger: true })) void deleteReward(r.id);
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-300">תגים</h2>
        <div className="flex flex-wrap gap-2">
          {g.achievements.map((a) => (
            <span key={a.id} title={a.description} className={cx("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm", a.event ? "bg-amber-300/12 text-amber-100" : "bg-white/[0.03] text-slate-600")}>
              <span className={cx(!a.event && "opacity-30 grayscale")}>{a.icon}</span> {a.title}
            </span>
          ))}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel>
          <h2 className="mb-2 text-sm font-semibold text-slate-300">גביעים</h2>
          {trophies.length === 0 ? (
            <p className="text-sm text-slate-500">גביע מוענק על כל מטרה שהושגה.</p>
          ) : (
            <ul className="space-y-1">
              {trophies.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm text-slate-200">
                  <Trophy size={15} className="gold-text" /> {t.title}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel>
          <h2 className="mb-2 text-sm font-semibold text-slate-300">קישוטים ומבנים מיוחדים</h2>
          {g.decorations.length === 0 && special.length === 0 ? (
            <p className="text-sm text-slate-500">הישגים מוסיפים קישוטים לכיכר המרכזית בעולם.</p>
          ) : (
            <ul className="space-y-1 text-sm text-slate-200">
              {g.decorations.map((d) => (
                <li key={d}>✦ {DECOR_LABEL[d] ?? d}</li>
              ))}
              {special.map((r) => (
                <li key={r.id}>🏛️ {r.stages[4].building} ({r.name})</li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </GamePage>
  );
}

function RewardForm({ db, onDone }: { db: DB; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"milestone" | "goal" | "level">("milestone");
  const [ref, setRef] = useState("");
  const [level, setLevel] = useState(5);
  const milestones = Object.values(db.milestones).filter((m) => m.status !== "done");
  const goals = Object.values(db.goals).filter((g) => g.status !== "done");
  const options = type === "milestone" ? milestones.map((m) => ({ id: m.id, title: m.title })) : goals.map((g) => ({ id: g.id, title: g.title }));
  const valid = title.trim() && (type === "level" ? level >= 1 : !!ref);
  const field = "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white";
  return (
    <Panel className="space-y-2.5">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="הפרס (למשל: ארוחה במסעדה)" maxLength={120} className={field} autoFocus />
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <select value={type} onChange={(e) => (setType(e.target.value as typeof type), setRef(""))} className={field} aria-label="מתי">
          <option value="milestone">באבן דרך</option>
          <option value="goal">במטרה</option>
          <option value="level">ברמה</option>
        </select>
        {type === "level" ? (
          <input type="number" min={1} max={200} value={level} onChange={(e) => setLevel(Number(e.target.value))} className={field} aria-label="רמה" />
        ) : (
          <select value={ref} onChange={(e) => setRef(e.target.value)} className={field} aria-label="בחירה">
            <option value="">בחירה…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <GhostButton onClick={onDone}>ביטול</GhostButton>
        <GoldButton
          disabled={!valid}
          onClick={async () => {
            const ok = await saveReward({ title: title.trim(), note: "", condition: type === "level" ? { type, level } : { type, refId: ref } });
            if (ok) onDone();
          }}
        >
          שמירה
        </GoldButton>
      </div>
    </Panel>
  );
}
