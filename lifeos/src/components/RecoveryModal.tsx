"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store/store";
import { buildRecoveryPlan } from "@/lib/recovery";
import { applyRecovery } from "@/lib/actions";
import { relativeDayLabel } from "@/lib/dates";
import { useToday } from "@/hooks/useToday";
import { Badge, Button, EmptyState, Modal } from "./ui";

export function RecoveryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useStore((s) => s.db);
  const today = useToday();
  // Build once per opening so the list doesn't shift while the user reviews it.
  const plan = useMemo(() => (open ? buildRecoveryPlan(db, today) : null), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  if (!open || !plan) return null;
  const chosen = plan.actions.filter((a) => !excluded.has(a.key));
  return (
    <Modal
      open
      onClose={onClose}
      title="תוכנית התאוששות"
      wide
      footer={
        <>
          <Button onClick={onClose}>ביטול</Button>
          <Button
            variant="primary"
            disabled={!chosen.length}
            onClick={async () => {
              await applyRecovery(chosen);
              onClose();
            }}
          >
            החלת {chosen.length} שינויים
          </Button>
        </>
      }
    >
      {plan.actions.length === 0 ? (
        <EmptyState title="אין משימות שפוספסו">הכול מעודכן 🙂</EmptyState>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-stone-600 dark:text-stone-300">
            במקום להעמיס הכול על מחר — פריסה לפי חשיבות והזמן הפנוי בשבוע הקרוב. אפשר להוריד סימון ממה שלא מתאים.
          </p>
          {plan.warnings.map((w) => (
            <p key={w} className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
              {w}
            </p>
          ))}
          <ul className="divide-y hairline">
            {plan.actions.map((a) => (
              <li key={a.key} className="flex items-start gap-3 py-2.5">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-accent-600"
                  checked={!excluded.has(a.key)}
                  aria-label={a.title}
                  onChange={(e) => {
                    const n = new Set(excluded);
                    if (e.target.checked) n.delete(a.key);
                    else n.add(a.key);
                    setExcluded(n);
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{a.title}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                    {a.action === "move" && <Badge tone="accent">← {relativeDayLabel(a.date!, today)}</Badge>}
                    {a.action === "skip" && <Badge>דילוג על המופע</Badge>}
                    {a.action === "unschedule" && <Badge tone="amber">ללא תאריך</Badge>}
                    <span>{a.reason}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
