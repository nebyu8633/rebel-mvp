"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Trash2, ShoppingCart, CheckCircle2, ChefHat, Pencil, X } from "lucide-react";
import { useStore, useSettings } from "@/lib/store/store";
import { useToday } from "@/hooks/useToday";
import { Meal, type MealPlanEntry, type MealSlot, type GroceryItem, type PantryItem } from "@/lib/types";
import { addDays, formatHebDate, startOfWeek, WEEKDAYS_HE, weekday, rangeDays } from "@/lib/dates";
import { generateGroceryList, nowIso, saveTask, setWeekApproved, uid, deleteMeal, updateSettings } from "@/lib/actions";
import { groceryKey } from "@/lib/grocery";
import { SEED_IDS } from "@/lib/seed";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, SectionTitle, Segmented, Select, Textarea, confirmDialog, cx } from "@/components/ui";

type Tab = "plan" | "meals" | "groceries" | "prep" | "pantry";
const SLOTS: Array<[MealSlot, string]> = [
  ["breakfast", "בוקר"],
  ["lunch", "צהריים"],
  ["dinner", "ערב"],
  ["snack", "ביניים"],
];

export default function MealsPage() {
  return (
    <Suspense>
      <Meals />
    </Suspense>
  );
}

function Meals() {
  const params = useSearchParams();
  const today = useToday();
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "plan");
  const thisWeek = startOfWeek(today);
  const [week, setWeek] = useState(() => (params.get("tab") === "groceries" && weekday(today) >= 4 ? addDays(thisWeek, 7) : thisWeek));

  return (
    <div>
      <PageHeader title="אוכל וקניות" subtitle="בונים ומאשרים תפריט ← רשימת קניות נוצרת ממנו ← תזכורות קניות והכנה." />
      <div className="-mx-1 mb-4 overflow-x-auto px-1">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "plan", label: "תפריט שבועי" },
            { value: "groceries", label: "קניות" },
            { value: "prep", label: "הכנה" },
            { value: "meals", label: "ארוחות" },
            { value: "pantry", label: "מזווה" },
          ]}
        />
      </div>
      {(tab === "plan" || tab === "groceries") && (
        <div className="mb-4 flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="שבוע קודם" onClick={() => setWeek(addDays(week, -7))}>
            <ChevronRight size={20} />
          </Button>
          <span className="text-sm font-semibold">
            שבוע {formatHebDate(week)} – {formatHebDate(addDays(week, 6))}
            {week === thisWeek ? " (השבוע)" : week === addDays(thisWeek, 7) ? " (שבוע הבא)" : ""}
          </span>
          <Button size="icon" variant="ghost" aria-label="שבוע הבא" onClick={() => setWeek(addDays(week, 7))}>
            <ChevronLeft size={20} />
          </Button>
        </div>
      )}
      {tab === "plan" && <PlanTab week={week} onGroceries={() => setTab("groceries")} />}
      {tab === "groceries" && <GroceriesTab week={week} onPlan={() => setTab("plan")} />}
      {tab === "prep" && <PrepTab />}
      {tab === "meals" && <MealsTab />}
      {tab === "pantry" && <PantryTab />}
    </div>
  );
}

// ───────── Weekly plan ─────────
function PlanTab({ week, onGroceries }: { week: string; onGroceries: () => void }) {
  const db = useStore((s) => s.db);
  const remove = useStore((s) => s.remove);
  const toast = useStore((s) => s.toast);
  const settings = useSettings();
  const [adding, setAdding] = useState<{ date: string; slot: MealSlot } | null>(null);
  const days = rangeDays(week, addDays(week, 6));
  const entries = Object.values(db.mealPlan).filter((e) => e.date >= week && e.date <= addDays(week, 6));
  const mw = db.mealWeeks[week];
  const changedAfterApproval = mw?.approved && entries.some((e) => mw.approvedAt && e.updatedAt > mw.approvedAt);
  const meals = Object.values(db.meals);

  return (
    <div className="space-y-4">
      <Card className={cx("flex flex-wrap items-center gap-3 py-3", mw?.approved && "border-accent-200 dark:border-accent-800/50")}>
        {mw?.approved ? (
          <>
            <CheckCircle2 className="text-accent-600" size={20} />
            <span className="flex-1 text-sm">
              התפריט אושר.{changedAfterApproval && <span className="text-amber-700"> בוצעו שינויים אחרי האישור — כדאי לעדכן את רשימת הקניות.</span>}
            </span>
            <Button size="sm" onClick={() => setWeekApproved(week, false)}>
              ביטול אישור
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={async () => {
                const r = await generateGroceryList(week);
                toast(`רשימת הקניות עודכנה (${r.count} פריטים)`, "success");
                onGroceries();
              }}
            >
              <ShoppingCart size={14} /> {changedAfterApproval ? "עדכון רשימת קניות" : "לרשימת הקניות"}
            </Button>
          </>
        ) : (
          <>
            <span className="flex-1 text-sm text-stone-600 dark:text-stone-300">{entries.length ? `${entries.length} ארוחות בתפריט. אחרי אישור תיווצר רשימת קניות.` : "התפריט ריק. מוסיפים ארוחות מהספרייה לכל יום."}</span>
            <Button
              size="sm"
              variant="primary"
              disabled={!entries.length}
              onClick={async () => {
                if (await setWeekApproved(week, true)) {
                  const r = await generateGroceryList(week);
                  toast(`התפריט אושר · ${r.count} פריטים ברשימת הקניות`, "success");
                }
              }}
            >
              אישור תפריט ויצירת רשימה
            </Button>
          </>
        )}
      </Card>

      {meals.length === 0 && (
        <EmptyState title="ספריית הארוחות ריקה">קודם מוסיפים ארוחות (עם מרכיבים וכמויות) בלשונית ״ארוחות״. האפליקציה לא ממציאה תפריט.</EmptyState>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {days.map((d) => (
          <Card key={d} className="p-3">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-sm font-semibold">
                {WEEKDAYS_HE[weekday(d)]} <span className="font-normal text-stone-500">{formatHebDate(d)}</span>
              </span>
            </div>
            <div className="space-y-1.5">
              {SLOTS.map(([slot, label]) => {
                const list = entries.filter((e) => e.date === d && e.slot === slot);
                return (
                  <div key={slot} className="flex items-start gap-2 text-sm">
                    <span className="w-14 shrink-0 pt-1 text-xs text-stone-500">{label}</span>
                    <div className="flex flex-1 flex-wrap gap-1">
                      {list.map((e) => (
                        <span key={e.id} className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2 py-1 text-xs dark:bg-white/5">
                          {db.meals[e.mealId]?.name ?? "?"}
                          {e.portions !== 1 && <span className="text-stone-500">×{e.portions}</span>}
                          {e.prepDate && <ChefHat size={11} className="text-stone-400" aria-label={`הכנה ב${formatHebDate(e.prepDate)}`} />}
                          <button aria-label="הסרה" onClick={() => void remove("mealPlan", e.id)} className="text-stone-400 hover:text-rose-600">
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                      <button
                        disabled={!meals.length}
                        onClick={() => setAdding({ date: d, slot })}
                        className="rounded-lg px-2 py-1 text-xs text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-40 dark:hover:bg-white/5"
                        aria-label={`הוספת ארוחת ${label} ל${formatHebDate(d)}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
      {adding && <AddEntry {...adding} prepDay={settings?.mealPrepDay ?? null} onClose={() => setAdding(null)} />}
    </div>
  );
}

function defaultPrepDate(date: string, prepDay: number | null): string | null {
  if (prepDay == null) return null;
  // the most recent preferred prep day on or before the meal date (within 6 days)
  for (let i = 0; i < 7; i++) {
    const d = addDays(date, -i);
    if (weekday(d) === prepDay) return d;
  }
  return null;
}

function AddEntry({ date, slot, prepDay, onClose }: { date: string; slot: MealSlot; prepDay: number | null; onClose: () => void }) {
  const db = useStore((s) => s.db);
  const put = useStore((s) => s.put);
  const meals = Object.values(db.meals).sort((a, b) => a.name.localeCompare(b.name, "he"));
  const [mealId, setMealId] = useState(meals[0]?.id ?? "");
  const [portions, setPortions] = useState("1");
  const [prep, setPrep] = useState(defaultPrepDate(date, prepDay) ?? "");
  async function save() {
    const p = Number(portions);
    if (!mealId || !(p > 0)) return;
    const n = nowIso();
    const entry: MealPlanEntry = { id: uid(), date, slot, mealId, portions: p, prepDate: prep || null, prepared: false, createdAt: n, updatedAt: n };
    if (await put("mealPlan", entry)) onClose();
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={`ארוחה ל${formatHebDate(date, { weekday: true })}`}
      footer={
        <>
          <Button onClick={onClose}>ביטול</Button>
          <Button variant="primary" onClick={save}>
            הוספה
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="ארוחה">
          <Select value={mealId} onChange={(e) => setMealId(e.target.value)}>
            {meals.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.portions} מנות במתכון)
              </option>
            ))}
          </Select>
        </Field>
        <Field label="מנות">
          <Input type="number" min={0.25} step={0.25} value={portions} onChange={(e) => setPortions(e.target.value)} />
        </Field>
        <Field label="יום הכנה (רשות)" hint="לתזכורות הכנה מראש">
          <Input type="date" value={prep} max={date} onChange={(e) => setPrep(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

// ───────── Groceries ─────────
function GroceriesTab({ week, onPlan }: { week: string; onPlan: () => void }) {
  const db = useStore((s) => s.db);
  const put = useStore((s) => s.put);
  const remove = useStore((s) => s.remove);
  const toast = useStore((s) => s.toast);
  const today = useToday();
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("");
  const items = Object.values(db.groceries)
    .filter((g) => g.weekStart === week)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
  const approved = db.mealWeeks[week]?.approved;
  const toBuy = items.filter((i) => !i.purchased);
  const bought = items.filter((i) => i.purchased);

  async function addManual() {
    if (!name.trim()) return;
    const n = nowIso();
    const q = qty.trim() === "" ? null : Number(qty);
    const item: GroceryItem = { id: uid(), weekStart: week, name: name.trim(), quantity: q != null && !Number.isNaN(q) ? q : null, unit: unit.trim(), purchased: false, source: "manual", key: groceryKey(name, unit), planQuantity: null, adjusted: false, createdAt: n, updatedAt: n };
    const dup = items.find((i) => i.key === item.key);
    if (dup) {
      toast(`"${dup.name}" כבר ברשימה — עדכנו את הכמות שלו`, "info");
      return;
    }
    if (await put("groceries", item)) {
      setName("");
      setQty("");
      setUnit("");
    }
  }

  const row = (it: GroceryItem) => (
    <li key={it.id} className="flex items-center gap-3 py-2">
      <input
        type="checkbox"
        className="h-5 w-5 accent-accent-600"
        checked={it.purchased}
        aria-label={`נקנה: ${it.name}`}
        onChange={(e) => void put("groceries", { ...it, purchased: e.target.checked, updatedAt: nowIso() })}
      />
      <span className={cx("min-w-0 flex-1", it.purchased && "text-stone-400 line-through")}>
        {it.name}
        {it.source === "manual" && <Badge className="ms-2">ידני</Badge>}
        {it.adjusted && it.planQuantity != null && <span className="ms-2 text-xs text-stone-400">(לפי התפריט: {it.planQuantity})</span>}
      </span>
      <Input
        className="w-20 py-1 text-sm"
        inputMode="decimal"
        aria-label={`כמות: ${it.name}`}
        key={`${it.id}:${it.quantity}`}
        defaultValue={it.quantity ?? ""}
        onBlur={(e) => {
          const v = e.target.value.trim() === "" ? null : Number(e.target.value);
          if (v !== it.quantity && (v === null || !Number.isNaN(v))) void put("groceries", { ...it, quantity: v, adjusted: it.source === "plan" ? true : it.adjusted, updatedAt: nowIso() });
        }}
      />
      <span className="w-12 text-xs text-stone-500">{it.unit}</span>
      <Button size="icon" variant="ghost" aria-label={`הסרה: ${it.name}`} onClick={() => void remove("groceries", it.id)}>
        <Trash2 size={14} />
      </Button>
    </li>
  );

  return (
    <div className="space-y-4">
      {weekday(today) >= 4 && week === addDays(startOfWeek(today), 7) && <p className="text-xs text-stone-500">הקניות של חמישי מכסות את התפריט של השבוע הבא.</p>}
      <Card className="flex flex-wrap items-center gap-3 py-3">
        {approved ? (
          <>
            <span className="flex-1 text-sm">הרשימה מבוססת על התפריט המאושר. מרכיב שחוזר בכמה ארוחות מופיע פעם אחת עם הכמות המצטברת.</span>
            <Button
              size="sm"
              onClick={async () => {
                const r = await generateGroceryList(week);
                toast(`עודכן מהתפריט: ${r.count} פריטים${r.removed ? `, ${r.removed} הוסרו` : ""}. סימוני ״נקנה״ ותיקוני כמות נשמרו.`, "success");
              }}
            >
              עדכון מהתפריט
            </Button>
          </>
        ) : (
          <>
            <span className="flex-1 text-sm text-stone-600 dark:text-stone-300">התפריט לשבוע הזה עדיין לא אושר — הרשימה תיווצר ממנו אחרי אישור.</span>
            <Button size="sm" variant="primary" onClick={onPlan}>
              לתפריט
            </Button>
          </>
        )}
      </Card>

      <Card>
        <SectionTitle hint={items.length ? `${bought.length}/${items.length} נקנו` : undefined}>לקנות</SectionTitle>
        {items.length === 0 ? (
          <EmptyState icon={<ShoppingCart size={26} />} title="הרשימה ריקה" />
        ) : (
          <>
            <ul className="divide-y hairline">{toBuy.map(row)}</ul>
            {bought.length > 0 && (
              <details className="mt-3" open={toBuy.length === 0}>
                <summary className="cursor-pointer text-sm text-stone-500">נקנו ({bought.length})</summary>
                <ul className="divide-y hairline">{bought.map(row)}</ul>
              </details>
            )}
          </>
        )}
        <div className="mt-4 grid grid-cols-[1fr_80px_80px_auto] gap-2">
          <Input placeholder="פריט נוסף" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addManual()} aria-label="שם פריט" />
          <Input placeholder="כמות" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="כמות" />
          <Input placeholder="יחידה" value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="יחידה" />
          <Button onClick={addManual} aria-label="הוספה">
            <Plus size={16} />
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ───────── Prep ─────────
function PrepTab() {
  const db = useStore((s) => s.db);
  const put = useStore((s) => s.put);
  const settings = useSettings();
  const today = useToday();
  const horizon = addDays(today, 14);
  const upcoming = Object.values(db.mealPlan).filter((e) => e.date >= today && e.date <= horizon);
  const byPrep = new Map<string, MealPlanEntry[]>();
  for (const e of upcoming.filter((e) => e.prepDate)) byPrep.set(e.prepDate!, [...(byPrep.get(e.prepDate!) ?? []), e]);
  const noPrep = upcoming.filter((e) => !e.prepDate);
  const routine = db.tasks[SEED_IDS.mealPrep];

  async function setDays(prefer: number | null, backup: number | null) {
    await updateSettings({ mealPrepDay: prefer, mealPrepBackupDay: backup });
    if (routine?.recurrence && prefer != null) {
      await saveTask({
        ...routine,
        recurrence: { ...routine.recurrence, byWeekday: [prefer], backupWeekday: backup, missedPolicy: backup != null ? "backup" : "carry" },
      });
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle hint="העדפה גמישה — לא שלושה סבבים חובה בשבוע. אם היום המועדף מתפספס, המשימה עוברת ליום הגיבוי.">ימי הכנה</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <Field label="יום מועדף">
            <Select value={settings?.mealPrepDay ?? ""} onChange={(e) => void setDays(e.target.value === "" ? null : Number(e.target.value), settings?.mealPrepBackupDay ?? null)}>
              <option value="">ללא</option>
              {WEEKDAYS_HE.map((d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="יום גיבוי">
            <Select value={settings?.mealPrepBackupDay ?? ""} onChange={(e) => void setDays(settings?.mealPrepDay ?? null, e.target.value === "" ? null : Number(e.target.value))}>
              <option value="">ללא</option>
              {WEEKDAYS_HE.map((d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {!routine && <p className="mt-2 text-xs text-stone-500">משימת ההכנה החוזרת נמחקה — אפשר ליצור חדשה ממסך המשימות.</p>}
      </Card>

      {byPrep.size === 0 && noPrep.length === 0 && <EmptyState icon={<ChefHat size={26} />} title="אין ארוחות מתוכננות בשבועיים הקרובים" />}

      {[...byPrep.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([d, list]) => (
          <Card key={d}>
            <SectionTitle hint={`${list.filter((e) => e.prepared).length}/${list.length} הוכנו`}>הכנה ב{formatHebDate(d, { weekday: true })}</SectionTitle>
            <ul className="divide-y hairline">
              {list
                .sort((a, b) => (a.date < b.date ? -1 : 1))
                .map((e) => {
                  const m = db.meals[e.mealId];
                  return (
                    <li key={e.id} className="flex items-start gap-3 py-2">
                      <input type="checkbox" className="mt-1 h-5 w-5 accent-accent-600" checked={e.prepared} aria-label={`הוכן: ${m?.name}`} onChange={(ev) => void put("mealPlan", { ...e, prepared: ev.target.checked, updatedAt: nowIso() })} />
                      <div className="min-w-0 flex-1">
                        <div className={cx("text-sm font-medium", e.prepared && "line-through text-stone-400")}>
                          {m?.name} ×{e.portions} <span className="font-normal text-stone-500">· ל{formatHebDate(e.date, { weekday: true })}</span>
                        </div>
                        {m?.prepNotes && <p className="text-xs text-stone-500">{m.prepNotes}</p>}
                      </div>
                    </li>
                  );
                })}
            </ul>
          </Card>
        ))}
      {noPrep.length > 0 && (
        <Card>
          <SectionTitle hint="אפשר לשייך יום הכנה בתפריט השבועי">ללא יום הכנה ({noPrep.length})</SectionTitle>
          <ul className="space-y-1 text-sm text-stone-600 dark:text-stone-300">
            {noPrep.map((e) => (
              <li key={e.id}>
                {db.meals[e.mealId]?.name} · {formatHebDate(e.date, { weekday: true })}
                <Select
                  className="ms-2 inline-block w-auto py-0.5 text-xs"
                  value=""
                  aria-label="יום הכנה"
                  onChange={(ev) => ev.target.value && void put("mealPlan", { ...e, prepDate: ev.target.value, updatedAt: nowIso() })}
                >
                  <option value="">שיוך יום הכנה…</option>
                  {rangeDays(today, e.date).map((d) => (
                    <option key={d} value={d}>
                      {formatHebDate(d, { weekday: true })}
                    </option>
                  ))}
                </Select>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

// ───────── Meal library ─────────
function MealsTab() {
  const db = useStore((s) => s.db);
  const [editing, setEditing] = useState<Meal | null>(null);
  const meals = Object.values(db.meals).sort((a, b) => a.name.localeCompare(b.name, "he"));
  const blank = (): Meal => ({ id: uid(), name: "", portions: 1, ingredients: [{ name: "", quantity: 0, unit: "" }], prepNotes: "", createdAt: nowIso(), updatedAt: nowIso() });
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => setEditing(blank())}>
          <Plus size={16} /> ארוחה חדשה
        </Button>
      </div>
      {meals.length === 0 ? (
        <EmptyState title="אין ארוחות בספרייה" action={<Button variant="primary" onClick={() => setEditing(blank())}>הוספת ארוחה</Button>}>
          ארוחות שאתם אוהבים, עם מרכיבים וכמויות. מהן נבנים התפריט ורשימת הקניות.
        </EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {meals.map((m) => (
            <Card key={m.id} className="py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-stone-500">
                    {m.portions} מנות · {m.ingredients.length} מרכיבים
                  </div>
                </div>
                <Button size="icon" variant="ghost" aria-label="עריכה" onClick={() => setEditing(m)}>
                  <Pencil size={16} />
                </Button>
              </div>
              <p className="mt-1 text-xs text-stone-500">{m.ingredients.map((i) => `${i.name} ${i.quantity}${i.unit ? " " + i.unit : ""}`).join(" · ")}</p>
            </Card>
          ))}
        </div>
      )}
      {editing && <MealForm meal={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function MealForm({ meal, onClose }: { meal: Meal; onClose: () => void }) {
  const db = useStore((s) => s.db);
  const put = useStore((s) => s.put);
  const exists = !!db.meals[meal.id];
  const [f, setF] = useState(meal);
  const [err, setErr] = useState<string | null>(null);
  const known = useMemo(() => [...new Set(Object.values(db.meals).flatMap((m) => m.ingredients.map((i) => i.name)))], [db.meals]);
  const usage = Object.values(db.mealPlan).filter((e) => e.mealId === meal.id).length;
  async function save() {
    const cleaned = { ...f, name: f.name.trim(), ingredients: f.ingredients.filter((i) => i.name.trim()).map((i) => ({ ...i, name: i.name.trim(), unit: i.unit.trim() })), updatedAt: nowIso() };
    const r = Meal.safeParse(cleaned);
    if (!r.success) return setErr(r.error.issues[0]?.message ?? "שגיאה");
    if (await put("meals", r.data)) onClose();
  }
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={exists ? "עריכת ארוחה" : "ארוחה חדשה"}
      footer={
        <>
          {exists && (
            <Button
              variant="ghost"
              className="me-auto text-rose-600"
              onClick={async () => {
                if (await confirmDialog({ title: "למחוק את הארוחה?", message: usage ? `היא מופיעה ${usage} פעמים בתפריט ותוסר משם.` : undefined, danger: true, confirmLabel: "מחיקה" })) {
                  if (await deleteMeal(meal.id)) onClose();
                }
              }}
            >
              מחיקה
            </Button>
          )}
          <Button onClick={onClose}>ביטול</Button>
          <Button variant="primary" onClick={save}>
            שמירה
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_100px] gap-3">
          <Field label="שם" error={err}>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="מנות במתכון">
            <Input type="number" min={1} value={f.portions} onChange={(e) => setF({ ...f, portions: Math.max(1, Number(e.target.value) || 1) })} />
          </Field>
        </div>
        <div>
          <span className="mb-1 block text-sm font-medium">מרכיבים</span>
          <datalist id="ingredients">
            {known.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
          <datalist id="units">
            {["גרם", "ק״ג", "מ״ל", "ליטר", "יח׳", "כף", "כפית", "כוס"].map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          <div className="space-y-2">
            {f.ingredients.map((ing, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_80px_auto] gap-2">
                <Input list="ingredients" placeholder="מרכיב" value={ing.name} aria-label="מרכיב" onChange={(e) => setF({ ...f, ingredients: f.ingredients.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                <Input inputMode="decimal" placeholder="כמות" value={ing.quantity || ""} aria-label="כמות" onChange={(e) => setF({ ...f, ingredients: f.ingredients.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) || 0 } : x)) })} />
                <Input list="units" placeholder="יחידה" value={ing.unit} aria-label="יחידה" onChange={(e) => setF({ ...f, ingredients: f.ingredients.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)) })} />
                <Button size="icon" variant="ghost" aria-label="הסרת מרכיב" onClick={() => setF({ ...f, ingredients: f.ingredients.filter((_, j) => j !== i) })}>
                  <X size={14} />
                </Button>
              </div>
            ))}
          </div>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setF({ ...f, ingredients: [...f.ingredients, { name: "", quantity: 0, unit: "" }] })}>
            <Plus size={14} /> מרכיב
          </Button>
        </div>
        <Field label="הערות הכנה">
          <Textarea value={f.prepNotes} onChange={(e) => setF({ ...f, prepNotes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

// ───────── Pantry ─────────
function PantryTab() {
  const db = useStore((s) => s.db);
  const put = useStore((s) => s.put);
  const remove = useStore((s) => s.remove);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("");
  const items = Object.values(db.pantry).sort((a, b) => a.name.localeCompare(b.name, "he"));
  async function add() {
    const q = Number(qty);
    if (!name.trim() || Number.isNaN(q) || q < 0) return;
    const n = nowIso();
    const item: PantryItem = { id: uid(), name: name.trim(), quantity: q, unit: unit.trim(), createdAt: n, updatedAt: n };
    if (await put("pantry", item)) {
      setName("");
      setQty("");
      setUnit("");
    }
  }
  return (
    <Card>
      <SectionTitle hint="אופציונלי. מה שיש בבית יורד אוטומטית מרשימת הקניות (באותה יחידת מידה).">מזווה</SectionTitle>
      {items.length > 0 && (
        <ul className="mb-4 divide-y hairline">
          {items.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="flex-1">{p.name}</span>
              <span className="ltr-nums">
                {p.quantity} {p.unit}
              </span>
              <Button size="icon" variant="ghost" aria-label={`הסרה: ${p.name}`} onClick={() => void remove("pantry", p.id)}>
                <Trash2 size={14} />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-[1fr_80px_80px_auto] gap-2">
        <Input placeholder="פריט" value={name} onChange={(e) => setName(e.target.value)} aria-label="פריט" />
        <Input placeholder="כמות" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="כמות" />
        <Input placeholder="יחידה" value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="יחידה" />
        <Button onClick={add} aria-label="הוספה">
          <Plus size={16} />
        </Button>
      </div>
    </Card>
  );
}
