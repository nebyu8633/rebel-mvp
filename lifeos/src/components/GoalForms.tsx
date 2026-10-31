"use client";
import { useState } from "react";
import { Goal, MotorcycleInfo } from "@/lib/types";
import { useStore } from "@/lib/store/store";
import { addWeight, nowIso, uid } from "@/lib/actions";
import { addMonths } from "@/lib/dates";
import { formatILS, motorcycleCost, monthsToSave, summarizeAccount } from "@/lib/finance";
import { latestWeight } from "@/lib/goals";
import { useToday } from "@/hooks/useToday";
import { Button, Field, Input, Modal, Select, Textarea, cx } from "./ui";
import { GOAL_COLORS } from "@/lib/goals";

export function blankGoal(today: string): Goal {
  const n = nowIso();
  return {
    id: uid(),
    title: "",
    description: "",
    why: "",
    kind: "custom",
    status: "active",
    startDate: today,
    startConfirmed: true,
    targetDate: addMonths(today, 12),
    unit: "",
    startValue: null,
    targetValue: null,
    manualValue: null,
    financeAccountId: null,
    info: {},
    color: "slate",
    order: 99,
    createdAt: n,
    updatedAt: n,
  };
}

const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

export function GoalForm({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const put = useStore((s) => s.put);
  const exists = useStore((s) => !!s.db.goals[goal.id]);
  const [f, setF] = useState(goal);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (p: Partial<Goal>) => setF((x) => ({ ...x, ...p }));
  const numeric = f.kind === "custom";

  async function save() {
    const r = Goal.safeParse({ ...f, title: f.title.trim(), startConfirmed: true, updatedAt: nowIso() });
    if (!r.success) {
      const e: Record<string, string> = {};
      for (const i of r.error.issues) e[String(i.path[0])] = i.message;
      return setErrors(e);
    }
    if (r.data.targetDate <= r.data.startDate) return setErrors({ targetDate: "תאריך היעד חייב להיות אחרי תאריך ההתחלה" });
    if (await put("goals", r.data)) onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={exists ? "עריכת מטרה" : "מטרה חדשה"}
      footer={
        <>
          <Button onClick={onClose}>ביטול</Button>
          <Button variant="primary" onClick={save}>
            שמירה
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="שם המטרה" error={errors.title}>
          <Input value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="למשל: לרוץ 10 ק״מ" />
        </Field>
        <Field label="למה זה חשוב לי" hint="משפט קצר שיופיע כתזכורת">
          <Input value={f.why} onChange={(e) => set({ why: e.target.value })} maxLength={500} />
        </Field>
        <Field label="תיאור">
          <Textarea value={f.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="תאריך התחלה" error={errors.startDate}>
            <Input type="date" value={f.startDate} onChange={(e) => e.target.value && set({ startDate: e.target.value })} />
          </Field>
          <Field label="תאריך יעד" error={errors.targetDate}>
            <Input type="date" value={f.targetDate} onChange={(e) => e.target.value && set({ targetDate: e.target.value })} />
          </Field>
        </div>
        {f.kind === "portfolio" && (
          <Field label="יעד שווי תיק (₪)">
            <Input inputMode="decimal" value={f.targetValue ?? ""} onChange={(e) => set({ targetValue: numOrNull(e.target.value) })} />
          </Field>
        )}
        {f.kind === "weight" && (
          <Field label="יעד עלייה (ק״ג)">
            <Input
              inputMode="decimal"
              value={String((f.info as { targetGain?: number }).targetGain ?? 10)}
              onChange={(e) => {
                const g = numOrNull(e.target.value) ?? 0;
                set({ info: { ...f.info, targetGain: g }, targetValue: f.startValue != null ? f.startValue + g : null });
              }}
            />
          </Field>
        )}
        {numeric && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="יחידה">
              <Input value={f.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="ק״מ / ₪ / ספרים" />
            </Field>
            <Field label="ערך התחלתי">
              <Input inputMode="decimal" value={f.startValue ?? ""} onChange={(e) => set({ startValue: numOrNull(e.target.value) })} />
            </Field>
            <Field label="ערך יעד">
              <Input inputMode="decimal" value={f.targetValue ?? ""} onChange={(e) => set({ targetValue: numOrNull(e.target.value) })} />
            </Field>
            <Field label="ערך נוכחי">
              <Input inputMode="decimal" value={f.manualValue ?? ""} onChange={(e) => set({ manualValue: numOrNull(e.target.value) })} />
            </Field>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="סטטוס">
            <Select value={f.status} onChange={(e) => set({ status: e.target.value as Goal["status"] })}>
              <option value="planning">בתכנון</option>
              <option value="active">פעילה</option>
              <option value="paused">מושהית</option>
              <option value="done">הושגה</option>
            </Select>
          </Field>
          <div>
            <span className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">צבע</span>
            <div className="flex gap-2 pt-1.5">
              {Object.entries(GOAL_COLORS).map(([k, c]) => (
                <button
                  key={k}
                  type="button"
                  aria-label={k}
                  aria-pressed={f.color === k}
                  onClick={() => set({ color: k })}
                  className={cx("h-7 w-7 rounded-full", c.bar, f.color === k && "ring-2 ring-stone-900 ring-offset-2 dark:ring-white")}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function MotorcycleInfoForm({ goal }: { goal: Goal }) {
  const put = useStore((s) => s.put);
  const db = useStore((s) => s.db);
  const info = MotorcycleInfo.parse(goal.info ?? {});
  const [f, setF] = useState(info);
  const [saved, setSaved] = useState(false);
  const cost = motorcycleCost(f);
  const acc = goal.financeAccountId ? db.financeAccounts[goal.financeAccountId] : null;
  const balance = acc ? summarizeAccount(Object.values(db.financeEntries).filter((e) => e.accountId === acc.id)) : null;
  const remaining = Math.max(0, cost.upfront - (balance?.currentValue ?? 0));
  const months = monthsToSave(remaining, f.monthlySavingCapacity);
  const num = (k: keyof MotorcycleInfo, label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <Input
        inputMode="decimal"
        value={(f[k] as number | null) ?? ""}
        onChange={(e) => {
          setSaved(false);
          setF({ ...f, [k]: numOrNull(e.target.value.replace(/[,₪\s]/g, "")) });
        }}
        placeholder="—"
      />
    </Field>
  );
  async function save() {
    const r = MotorcycleInfo.safeParse(f);
    if (!r.success) return;
    if (await put("goals", { ...goal, info: r.data, targetValue: cost.upfront || null, updatedAt: nowIso() })) setSaved(true);
  }
  return (
    <div className="space-y-4">
      <Field label="דגם רצוי">
        <Input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} placeholder="יצרן, דגם, נפח" />
      </Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {num("price", "מחיר משוער (₪)")}
        {num("licenseCost", "עלות רישיון (₪)", "ריק אם כבר יש רישיון")}
        {num("gearCost", "ציוד מגן (₪)")}
        {num("insuranceYearly", "ביטוח לשנה (₪)")}
        {num("maintenanceYearly", "תחזוקה לשנה (₪)", "לא נכלל ביעד הרכישה")}
        {num("otherCosts", "הוצאות נוספות (₪)")}
        {num("monthlySavingCapacity", "יכולת חיסכון חודשית (₪)")}
      </div>
      <Field label="הערות על הרישיון">
        <Input value={f.licenseNotes} onChange={(e) => setF({ ...f, licenseNotes: e.target.value })} placeholder="דרגה נדרשת, מה כבר יש" />
      </Field>
      <div className="rounded-xl bg-stone-50 p-3 text-sm dark:bg-white/[0.03]">
        <div className="flex flex-wrap justify-between gap-2">
          <span>עלות רכישה כוללת (ממה שהוזן):</span>
          <b className="ltr-nums">{formatILS(cost.upfront)}</b>
        </div>
        {balance && (
          <div className="flex flex-wrap justify-between gap-2">
            <span>נותר לחסוך:</span>
            <b className="ltr-nums">{formatILS(remaining)}</b>
          </div>
        )}
        {months != null && remaining > 0 && <div className="text-stone-500">בקצב שהוזן: כ-{months} חודשים</div>}
        {cost.missing.length > 0 && <div className="mt-1 text-xs text-amber-700">חסר: {cost.missing.join(", ")}</div>}
      </div>
      <Button variant="primary" onClick={save}>
        {saved ? "נשמר ✓" : "שמירת פרטים"}
      </Button>
    </div>
  );
}

export function WeightStart({ goal }: { goal: Goal }) {
  const put = useStore((s) => s.put);
  const db = useStore((s) => s.db);
  const today = useToday();
  const last = latestWeight(Object.values(db.weightLogs));
  const [kg, setKg] = useState(goal.startValue != null ? String(goal.startValue) : last ? String(last.kg) : "");
  const [err, setErr] = useState<string | null>(null);
  const gain = (goal.info as { targetGain?: number }).targetGain ?? 10;
  async function confirm() {
    const v = Number(kg);
    if (!kg || Number.isNaN(v) || v < 20 || v > 400) return setErr("יש להזין משקל תקין בק״ג");
    setErr(null);
    const ok = await put("goals", { ...goal, startValue: v, targetValue: Math.round((v + gain) * 10) / 10, status: goal.status === "planning" ? "active" : goal.status, updatedAt: nowIso() });
    if (ok && !Object.values(db.weightLogs).some((w) => w.date === goal.startDate)) await addWeight(goal.startDate <= today ? goal.startDate : today, v, "משקל התחלתי");
  }
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="משקל התחלתי (ק״ג)" error={err} className="w-40">
        <Input inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} />
      </Field>
      <Button variant="primary" onClick={confirm}>
        {goal.startValue != null ? "עדכון" : "אישור"}
      </Button>
      {goal.startValue != null && <span className="pb-2 text-sm text-stone-500">יעד: {goal.targetValue} ק״ג</span>}
    </div>
  );
}

export function WeightLogger() {
  const today = useToday();
  const [kg, setKg] = useState("");
  const [date, setDate] = useState(today);
  const [err, setErr] = useState<string | null>(null);
  async function add() {
    const v = Number(kg);
    if (!kg || Number.isNaN(v) || v < 20 || v > 400) return setErr("משקל לא תקין");
    if (date > today) return setErr("תאריך עתידי");
    setErr(null);
    if (await addWeight(date, v)) setKg("");
  }
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="שקילה (ק״ג)" error={err} className="w-32">
        <Input inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} />
      </Field>
      <Field label="תאריך" className="w-40">
        <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Button variant="primary" onClick={add}>
        רישום
      </Button>
    </div>
  );
}
