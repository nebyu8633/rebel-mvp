"use client";
import Link from "next/link";
import { useState } from "react";
import { Plus, Sparkles, Target } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useToday } from "@/hooks/useToday";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { GoalForm, blankGoal } from "@/components/GoalForms";
import { GoalCard } from "@/components/GoalCard";
import type { Goal } from "@/lib/types";

export default function GoalsPage() {
  const db = useStore((s) => s.db);
  const today = useToday();
  const [editing, setEditing] = useState<Goal | null>(null);
  const goals = Object.values(db.goals).sort((a, b) => a.order - b.order);
  const active = goals.filter((g) => g.status !== "done");
  const done = goals.filter((g) => g.status === "done");

  return (
    <div>
      <PageHeader
        title="המטרות שלי"
        actions={
          <>
            <Button variant="ghost" onClick={() => setEditing(blankGoal(today))}>
              ידנית
            </Button>
            <Link href="/goals/new">
              <Button variant="primary">
                <Plus size={16} /> מטרה חדשה
              </Button>
            </Link>
          </>
        }
      />
      {goals.length === 0 ? (
        <EmptyState
          icon={<Target size={28} />}
          title="עדיין אין מטרות"
          action={
            <Link href="/goals/new">
              <Button variant="primary">
                <Sparkles size={16} /> מטרה חדשה
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {active.map((g) => (
            <GoalCard key={g.id} goal={g} today={today} />
          ))}
        </div>
      )}
      {done.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-semibold text-stone-500">הושגו</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {done.map((g) => (
              <GoalCard key={g.id} goal={g} today={today} compact />
            ))}
          </div>
        </>
      )}
      {editing && <GoalForm goal={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
