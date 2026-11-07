"use client";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { useGame } from "@/lib/game/useGame";
import { updateProfile } from "@/lib/game/actions";
import { formatHebDate } from "@/lib/dates";
import { cx } from "@/components/ui";
import { ACCENTS, Avatar, EMBLEMS, EMBLEM_NAMES, GamePage, GoldButton, OUTFITS, Panel, SKINS, XpBar } from "@/components/game/bits";
import type { GameProfile } from "@/lib/types";

const PARTS: Array<{ key: keyof GameProfile["avatar"]; label: string; swatches: string[] | null }> = [
  { key: "skin", label: "גוון", swatches: SKINS },
  { key: "outfit", label: "לבוש", swatches: OUTFITS },
  { key: "accent", label: "עיטור", swatches: ACCENTS },
  { key: "emblem", label: "סמל", swatches: null },
];

export default function CharacterPage() {
  const g = useGame();
  const [draft, setDraft] = useState<GameProfile["avatar"] | null>(null);
  const [name, setName] = useState("");
  useEffect(() => {
    if (g.profile && !draft) {
      setDraft(g.profile.avatar);
      setName(g.profile.displayName);
    }
  }, [g.profile, draft]);
  const avatar = draft ?? g.profile?.avatar;
  const dirty = !!g.profile && !!draft && (JSON.stringify(draft) !== JSON.stringify(g.profile.avatar) || name !== g.profile.displayName);
  const unlocked = g.achievements.filter((a) => a.event).length;

  return (
    <GamePage title="הדמות" subtitle="התכונות עולות רק מפעילות מאומתת.">
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Panel className="flex flex-col items-center text-center">
          <Avatar avatar={avatar} size={128} />
          <div className="mt-3 text-xl font-bold text-white">{name || "חוקר"}</div>
          <div className="mt-0.5 text-sm text-slate-400">
            רמה <span className="ltr-nums">{g.level.level}</span> · <span className="ltr-nums">{g.xp}</span> XP
          </div>
          <XpBar fraction={g.level.fraction} className="mt-3 w-full max-w-xs" />
          <div className="mt-1 text-[11px] text-slate-500 ltr-nums">
            {g.level.into}/{g.level.need} לרמה {g.level.level + 1}
          </div>

          {g.profile && avatar && (
            <div className="mt-5 w-full space-y-3 text-start">
              <label className="block text-[12px] text-slate-400">
                שם הדמות
                <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="חוקר" className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
              </label>
              {PARTS.map((p) => (
                <div key={p.key}>
                  <div className="mb-1 text-[12px] text-slate-400">{p.label}</div>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setDraft({ ...avatar, [p.key]: i })}
                        aria-label={`${p.label} ${p.swatches ? i + 1 : EMBLEM_NAMES[i]}`}
                        aria-pressed={avatar[p.key] === i}
                        className={cx("flex h-9 w-9 items-center justify-center rounded-full border-2 text-base", avatar[p.key] === i ? "border-amber-300" : "border-transparent hover:border-white/30")}
                        style={p.swatches ? { background: p.swatches[i] } : { background: "rgba(255,255,255,.06)" }}
                      >
                        {!p.swatches && EMBLEMS[i]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <GoldButton disabled={!dirty} onClick={() => void updateProfile({ avatar: draft!, displayName: name.trim() }, g.today)} className="w-full">
                שמירת הדמות
              </GoldButton>
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel>
            <h2 className="mb-3 text-sm font-semibold text-slate-200">תכונות</h2>
            <ul className="space-y-3">
              {g.attributes.map((a) => (
                <li key={a.id}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="font-medium text-white">
                      {a.name} <span className="text-[11px] font-normal text-slate-500">{a.hint}</span>
                    </span>
                    <span className="text-[12px] text-slate-400 ltr-nums">
                      רמה {a.level} · {a.xp} XP
                    </span>
                  </div>
                  <XpBar fraction={a.xp ? a.fraction : 0} thin />
                </li>
              ))}
            </ul>
          </Panel>
          <Panel>
            <h2 className="mb-3 text-sm font-semibold text-slate-200">
              הישגים <span className="text-slate-500 ltr-nums">({unlocked}/{g.achievements.length})</span>
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {g.achievements.map((a) => (
                <li key={a.id} className={cx("flex items-start gap-3 rounded-xl p-3", a.event ? "bg-amber-300/10" : "bg-white/[0.03]")}>
                  <span className={cx("text-2xl", !a.event && "opacity-30 grayscale")}>{a.icon}</span>
                  <div className="min-w-0">
                    <div className={cx("text-sm font-semibold", a.event ? "text-amber-100" : "text-slate-400")}>{a.title}</div>
                    <div className="text-[12px] text-slate-400">{a.description}</div>
                    {a.event ? (
                      <div className="mt-0.5 text-[11px] text-slate-500">{formatHebDate(a.event.at.slice(0, 10))}</div>
                    ) : (
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-600">
                        <Lock size={10} /> נעול
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </GamePage>
  );
}
