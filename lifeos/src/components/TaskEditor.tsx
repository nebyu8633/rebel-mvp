"use client";
import { useEffect, useMemo, useState } from "react";
import { Task, type Priority, type TaskStatus } from "@/lib/types";
import { useUI } from "@/lib/store/ui";
import { useStore } from "@/lib/store/store";
import { blankTask, cancelOccurrence, deleteTask, editOccurrence, endSeries, saveTask, setInstanceStatus } from "@/lib/actions";
import { useToday } from "@/hooks/useToday";
import { Button, Field, Input, Modal, Segmented, Select, Textarea, Toggle, confirmDialog, cx } from "./ui";
import { RecurrenceEditor, defaultRule } from "./RecurrenceEditor";
import { formatHebDate } from "@/lib/dates";
import { blockingDependencies } from "@/lib/tasks";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  planned: "מתוכנן",
  in_progress: "בתהליך",
  completed: "הושלם",
  skipped: "דילגתי",
  postponed: "נדחה",
};
export const PRIORITY_LABELS: Record<Priority, string> = { high: "גבוהה", medium: "בינונית", low: "נמוכה" };

const DURATIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180];
const REMINDERS: Array<[number | null, string]> = [
  [null, "ללא תזכורת"],
  [0, "בזמן ההתחלה"],
  [5, "5 דק׳ לפני"],
  [10, "10 דק׳ לפני"],
  [15, "15 דק׳ לפני"],
  [30, "30 דק׳ לפני"],
  [60, "שעה לפני"],
  [120, "שעתיים לפני"],
];

export function TaskEditorHost() {
  const req = useUI((s) => s.editor);
  const close = useUI((s) => s.closeEditor);
  if (!req) return null;
  return <TaskEditor key={req.task?.id ?? req.instance?.key ?? "new"} onClose={close} />;
}

function TaskEditor({ onClose }: { onClose: () => void }) {
  const req = useUI((s) => s.editor)!;
  const db = useStore((s) => s.db);
  const today = useToday();
  const inst = req.instance;
  const initial = useMemo(() => req.task ?? inst?.task ?? blankTask({ date: today, ...req.defaults }), [req, inst, today]);
  const isNew = !db.tasks[initial.id];
  const [scope, setScope] = useState<"one" | "series">(inst?.recurring ? "one" : "series");
  const [form, setForm] = useState<Task>(initial);
  const [occ, setOcc] = useState({
    title: inst?.title ?? "",
    notes: inst?.notes ?? "",
    date: inst?.date ?? today,
    startTime: inst?.startTime ?? "",
    status: inst?.status ?? "planned",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [showMore, setShowMore] = useState(!!(initial.notes || initial.deadline || initial.rationale || initial.dependsOn.length));

  useEffect(() => {
    setErrors({});
  }, [form]);
  const set = (p: Partial<Task>) => setForm((f) => ({ ...f, ...p }));
  const goals = Object.values(db.goals).sort((a, b) => a.order - b.order);
  const milestones = Object.values(db.milestones)
    .filter((m) => m.goalId === form.goalId)
    .sort((a, b) => a.order - b.order);
  const depCandidates = Object.values(db.tasks).filter((t) => t.id !== form.id && !t.recurrence && (t.status !== "completed" || form.dependsOn.includes(t.id)));
  const blocked = blockingDependencies(db, form);

  async function submit() {
    setBusy(true);
    try {
      if (inst?.recurring && scope === "one") {
        if (!occ.title.trim()) return setErrors({ title: "חובה לכתוב מה המשימה" });
        await editOccurrence(inst, { title: occ.title.trim(), notes: occ.notes, date: occ.date, startTime: occ.startTime || null });
        if (occ.status !== inst.status) await setInstanceStatus({ ...inst, date: occ.date }, occ.status);
        onClose();
        return;
      }
      const candidate = { ...form, title: form.title.trim() };
      if (candidate.reminderMinutes != null && !candidate.startTime && !candidate.recurrence) candidate.reminderMinutes = null;
      const r = Task.safeParse(candidate);
      if (!r.success) {
        const errs: Record<string, string> = {};
        for (const i of r.error.issues) errs[String(i.path[0])] = i.message;
        setErrors(errs);
        return;
      }
      if (r.data.recurrence && r.data.recurrence.missedPolicy === "backup" && r.data.recurrence.backupWeekday == null)
        return setErrors({ recurrence: "יש לבחור יום גיבוי" });
      if (r.data.deadline && r.data.date && r.data.date > r.data.deadline)
        return setErrors({ deadline: "התאריך המתוכנן מאוחר מהדדליין" });
      if (await saveTask(r.data)) onClose();
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (inst?.recurring) {
      const choice = await confirmDialog({
        title: "מה למחוק?",
        message: "אפשר לבטל רק את המופע הזה, או לסיים את הסדרה מהיום (ההיסטוריה נשמרת).",
        confirmLabel: scope === "one" ? "ביטול המופע הזה" : "סיום הסדרה מהיום",
        danger: true,
      });
      if (!choice) return;
      if (scope === "one") await cancelOccurrence(inst);
      else await endSeries(inst.task, today);
      onClose();
      return;
    }
    const ok = await confirmDialog({
      title: "למחוק את המשימה?",
      message: form.recurrence ? "הסדרה וכל ההיסטוריה שלה יימחקו לצמיתות." : `"${form.title}" תימחק לצמיתות.`,
      confirmLabel: "מחיקה",
      danger: true,
    });
    if (ok && (await deleteTask(form.id))) onClose();
  }

  const occurrenceMode = inst?.recurring && scope === "one";

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? "משימה חדשה" : "עריכת משימה"}
      wide
      footer={
        <>
          {!isNew && (
            <Button variant="ghost" className="me-auto text-rose-600" onClick={onDelete}>
              {inst?.recurring ? (scope === "one" ? "ביטול מופע" : "סיום סדרה") : "מחיקה"}
            </Button>
          )}
          <Button onClick={onClose}>ביטול</Button>
          <Button variant="primary" onClick={submit} disabled={busy}>
            שמירה
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {inst?.recurring && (
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={scope}
              onChange={setScope}
              options={[
                { value: "one", label: `רק ${formatHebDate(inst.originalDate!)}` },
                { value: "series", label: "כל הסדרה" },
              ]}
            />
          </div>
        )}

        {occurrenceMode ? (
          <>
            <Field label="מה צריך לעשות" error={errors.title}>
              <Input value={occ.title} onChange={(e) => setOcc({ ...occ, title: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="תאריך">
                <Input type="date" value={occ.date} onChange={(e) => e.target.value && setOcc({ ...occ, date: e.target.value })} />
              </Field>
              <Field label="שעה">
                <Input type="time" value={occ.startTime} onChange={(e) => setOcc({ ...occ, startTime: e.target.value })} />
              </Field>
            </div>
            <Field label="סטטוס">
              <Select value={occ.status} onChange={(e) => setOcc({ ...occ, status: e.target.value as TaskStatus })}>
                {Object.entries(STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="הערות למופע הזה">
              <Textarea value={occ.notes} onChange={(e) => setOcc({ ...occ, notes: e.target.value })} />
            </Field>
          </>
        ) : (
          <>
            <Field label="מה צריך לעשות" error={errors.title}>
              <Input autoFocus value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="למשל: להשוות הצעות ביטוח" maxLength={200} />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="מטרה">
                <Select value={form.goalId ?? ""} onChange={(e) => set({ goalId: e.target.value || null, milestoneId: null })}>
                  <option value="">ללא מטרה</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </Select>
              </Field>
              {milestones.length > 0 && (
                <Field label="אבן דרך">
                  <Select value={form.milestoneId ?? ""} onChange={(e) => set({ milestoneId: e.target.value || null })}>
                    <option value="">—</option>
                    {milestones.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>

            <div>
              <span className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">עדיפות</span>
              <Segmented
                value={form.priority}
                onChange={(v) => set({ priority: v })}
                options={(["high", "medium", "low"] as const).map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
              />
            </div>

            <Toggle
              checked={!!form.recurrence}
              onChange={(v) => set({ recurrence: v ? defaultRule(form.date ?? today) : null })}
              label="משימה חוזרת"
            />

            {form.recurrence ? (
              <>
                <RecurrenceEditor value={form.recurrence} onChange={(r) => set({ recurrence: r })} />
                {errors.recurrence && <p className="text-xs text-rose-600">{errors.recurrence}</p>}
              </>
            ) : (
              <Field label="תאריך" error={errors.date} hint={!form.date ? "בלי תאריך — המשימה תופיע ברשימת ״ללא תאריך״" : undefined}>
                <div className="flex gap-2">
                  <Input type="date" value={form.date ?? ""} onChange={(e) => set({ date: e.target.value || null })} />
                  {form.date && (
                    <Button variant="ghost" onClick={() => set({ date: null })}>
                      ללא
                    </Button>
                  )}
                </div>
              </Field>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="שעת התחלה (רשות)" error={errors.startTime}>
                <Input type="time" value={form.startTime ?? ""} onChange={(e) => set({ startTime: e.target.value || null })} />
              </Field>
              <Field label="משך משוער">
                <Select value={form.estimatedMinutes ?? ""} onChange={(e) => set({ estimatedMinutes: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">לא ידוע</option>
                  {[...new Set([...DURATIONS, ...(form.estimatedMinutes ? [form.estimatedMinutes] : [])])]
                    .sort((a, b) => a - b)
                    .map((d) => (
                      <option key={d} value={d}>
                        {d < 60 ? `${d} דק׳` : `${d / 60} שע׳`}
                      </option>
                    ))}
                </Select>
              </Field>
            </div>

            <Field label="תזכורת" hint={!form.startTime ? "תזכורת דורשת שעת התחלה" : undefined}>
              <Select
                disabled={!form.startTime}
                value={form.reminderMinutes ?? ""}
                onChange={(e) => set({ reminderMinutes: e.target.value === "" ? null : Number(e.target.value) })}
              >
                {REMINDERS.map(([v, l]) => (
                  <option key={l} value={v ?? ""}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>

            {!isNew && !form.recurrence && (
              <Field label="סטטוס">
                <Select value={form.status} onChange={(e) => set({ status: e.target.value as TaskStatus })}>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <button type="button" className="text-sm font-medium text-accent-700 dark:text-accent-200" onClick={() => setShowMore((s) => !s)} aria-expanded={showMore}>
              {showMore ? "פחות פרטים" : "עוד פרטים: דדליין, הערות, תלויות"}
            </button>

            {showMore && (
              <div className="space-y-4">
                <Field label="דדליין (רשות)" error={errors.deadline}>
                  <Input type="date" value={form.deadline ?? ""} onChange={(e) => set({ deadline: e.target.value || null })} />
                </Field>
                <Field label="למה זה חשוב" hint="יוצג ליד המשימה כתזכורת לקשר שלה למטרה">
                  <Input value={form.rationale} onChange={(e) => set({ rationale: e.target.value })} maxLength={600} />
                </Field>
                <Field label="הערות">
                  <Textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
                </Field>
                {depCandidates.length > 0 && !form.recurrence && (
                  <div>
                    <span className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">תלויה במשימות</span>
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border hairline p-2">
                      {depCandidates
                        .filter((t) => !form.goalId || t.goalId === form.goalId || form.dependsOn.includes(t.id))
                        .slice(0, 50)
                        .map((t) => (
                          <label key={t.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="accent-accent-600"
                              checked={form.dependsOn.includes(t.id)}
                              onChange={(e) => set({ dependsOn: e.target.checked ? [...form.dependsOn, t.id] : form.dependsOn.filter((x) => x !== t.id) })}
                            />
                            <span className={cx(t.status === "completed" && "line-through text-stone-400")}>{t.title}</span>
                          </label>
                        ))}
                    </div>
                    {blocked.length > 0 && <p className="mt-1 text-xs text-amber-700">ממתינה ל: {blocked.map((b) => b.title).join(", ")}</p>}
                  </div>
                )}
                {form.history.length > 1 && (
                  <details className="text-xs text-stone-500">
                    <summary className="cursor-pointer">היסטוריה ({form.history.length})</summary>
                    <ul className="mt-1 space-y-0.5">
                      {form.history
                        .slice()
                        .reverse()
                        .slice(0, 10)
                        .map((h, i) => (
                          <li key={i}>
                            {new Date(h.at).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })} ·{" "}
                            {h.action === "rescheduled" ? `הוזז: ${h.from ?? "—"} ← ${h.to ?? "ללא תאריך"}` : h.action === "status" ? `סטטוס: ${STATUS_LABELS[h.to as TaskStatus] ?? h.to}` : h.action === "created" ? "נוצרה" : "נערכה"}
                          </li>
                        ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
