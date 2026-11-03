"use client";
import Link from "next/link";
import { CalendarDays, Flag, ArrowLeft, Sparkles } from "lucide-react";
import type { Goal } from "@/lib/types";
import { useStore } from "@/lib/store/store";
import { goalColor, goalSnapshot } from "@/lib/goals";
import { formatHebDate, relativeDayLabel } from "@/lib/dates";
import { Badge, Ring, cx } from "./ui";

/** Compact goal card: title, target date, progress, next milestone, next action. */
export function GoalCard({ goal, today, compact }: { goal: Goal; today: string; compact?: boolean }) {
  const db = useStore((s) => s.db);
  const s = goalSnapshot(db, goal, today);
  const c = goalColor(goal.color);
  return (
    <Link href={`/goals/${goal.id}`} className="surface group block rounded-2xl border p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <Ring value={s.progress.fraction} colorClass={c.text} label={goal.title} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-[15px] font-semibold">{goal.title}</h3>
            {s.plan === "draft" && <Badge tone="amber">טיוטה</Badge>}
            {s.plan === "none" && goal.status === "planning" && <Badge tone="amber">לתכנן</Badge>}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-stone-500">
            <CalendarDays size={12} /> {formatHebDate(goal.targetDate, { year: true })}
          </div>
        </div>
      </div>
      {!compact && s.plan === "none" && !s.milestonesTotal && !s.nextAction && (
        <div className="mt-3 flex items-center gap-1.5 text-sm font-medium text-accent-700 dark:text-accent-200">
          <Sparkles size={14} /> לבנות תוכנית
        </div>
      )}
      {!compact && !(s.plan === "none" && !s.milestonesTotal && !s.nextAction) && (
        <div className="mt-3 space-y-1.5 text-sm">
          <Row icon={<Flag size={13} />} label="אבן דרך" value={s.nextMilestone ? s.nextMilestone.title : s.milestonesTotal ? "כולן הושלמו" : "—"} />
          <Row
            icon={<ArrowLeft size={13} />}
            label="הצעד הבא"
            value={s.nextAction ? `${s.nextAction.title}${s.nextAction.date ? ` · ${relativeDayLabel(s.nextAction.date, today)}` : ""}` : "—"}
            warn={!!s.nextAction?.date && s.nextAction.date < today}
          />
        </div>
      )}
      {compact && s.nextAction && <p className="mt-2 truncate text-xs text-stone-500">← {s.nextAction.title}</p>}
    </Link>
  );
}

function Row({ icon, label, value, warn }: { icon: React.ReactNode; label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-stone-400">{icon}</span>
      <span className="w-16 shrink-0 text-xs text-stone-500">{label}</span>
      <span className={cx("min-w-0 flex-1 truncate", warn && "text-rose-600")}>{value}</span>
    </div>
  );
}
