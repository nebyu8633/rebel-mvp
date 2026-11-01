"use client";
import Link from "next/link";
import { useState } from "react";
import { Plus, Target, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useToday } from "@/hooks/useToday";
import { goalColor, goalProgress } from "@/lib/goals";
import { formatHebDate, diffDays } from "@/lib/dates";
import { Badge, Button, Card, EmptyState, PageHeader, ProgressBar, cx } from "@/components/ui";
import { GoalForm, blankGoal } from "@/components/GoalForms";
import type { Goal } from "@/lib/types";
import { GOAL_STATUS } from "@/lib/goals";


export default function GoalsPage() {
  const db = useStore((s) => s.db);
  const today = useToday();
  const [editing, setEditing] = useState<Goal | null>(null);
  const goals = Object.values(db.goals).sort((a, b) => a.order - b.order);

  return (
    <div>
      <PageHeader
        title="המטרות שלי"
        subtitle="מטרות שנתיות ← אבני דרך ← יעדים חודשיים ושבועיים ← משימות יומיות"
        actions={
          <>
            <Button onClick={() => setEditing(blankGoal(today))}>מטרה ידנית (בלי שיחה)</Button>
            <Link href="/goals/new">
              <Button variant="primary">
                <Plus size={16} /> מטרה חדשה
              </Button>
            </Link>
          </>
        }
      />
      {goals.length === 0 ? (
        <EmptyState icon={<Target size={28} />} title="עדיין אין מטרות" action={<Link href="/goals/new"><Button variant="primary"><Sparkles size={16} /> מטרה חדשה</Button></Link>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((g) => {
            const p = goalProgress(db, g, today);
            const c = goalColor(g.color);
            const ms = Object.values(db.milestones).filter((m) => m.goalId === g.id);
            const openTasks = Object.values(db.tasks).filter((t) => t.goalId === g.id && !t.recurrence && t.status !== "completed" && t.status !== "skipped").length;
            const daysLeft = diffDays(today, g.targetDate);
            return (
              <Link key={g.id} href={`/goals/${g.id}`} className="block">
                <Card className="h-full transition-shadow hover:shadow-md">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={cx("h-2.5 w-2.5 rounded-full", c.dot)} />
                        <h2 className="text-lg font-semibold">{g.title}</h2>
                      </div>
                      {g.why && <p className="mt-0.5 text-sm text-stone-500">{g.why}</p>}
                    </div>
                    <span className="flex flex-col items-end gap-1">
                      <Badge tone={GOAL_STATUS[g.status].tone}>{GOAL_STATUS[g.status].label}</Badge>
                      {Object.values(db.planVersions).some((v) => v.goalId === g.id && v.status === "approved") ? (
                        <Badge tone="accent">תוכנית פעילה</Badge>
                      ) : Object.values(db.planVersions).some((v) => v.goalId === g.id && v.status === "draft") ? (
                        <Badge tone="amber">טיוטת תוכנית</Badge>
                      ) : null}
                    </span>
                  </div>
                  <ProgressBar value={p.fraction} barClass={c.bar} label={g.title} />
                  <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-stone-500">
                    <span>{p.fraction != null ? `${Math.round(p.fraction * 100)}% הושלם` : p.missing.length ? `חסר: ${p.missing.slice(0, 2).join(", ")}` : "—"}</span>
                    <span>
                      יעד: {formatHebDate(g.targetDate, { year: true })}
                      {daysLeft > 0 ? ` · ${daysLeft} ימים` : ""}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-3 text-xs text-stone-500">
                    <span>{ms.length} אבני דרך</span>
                    <span>{openTasks} משימות פתוחות</span>
                    {!g.startConfirmed && <span className="text-amber-700">תאריך התחלה לא אושר</span>}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
      {editing && <GoalForm goal={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
