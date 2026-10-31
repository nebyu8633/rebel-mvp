import type { GroceryItem, Meal, MealPlanEntry, PantryItem } from "./types";

/** Unit aliases → canonical unit + multiplier into a base unit (so 1 ק״ג + 300 גרם = 1.3 ק״ג). */
const UNIT_TABLE: Record<string, { base: string; factor: number }> = {
  "גרם": { base: "g", factor: 1 },
  "גר": { base: "g", factor: 1 },
  "גר׳": { base: "g", factor: 1 },
  "ג": { base: "g", factor: 1 },
  "g": { base: "g", factor: 1 },
  "ק״ג": { base: "g", factor: 1000 },
  'ק"ג': { base: "g", factor: 1000 },
  "קג": { base: "g", factor: 1000 },
  "קילו": { base: "g", factor: 1000 },
  "kg": { base: "g", factor: 1000 },
  "מ״ל": { base: "ml", factor: 1 },
  'מ"ל': { base: "ml", factor: 1 },
  "מל": { base: "ml", factor: 1 },
  "ml": { base: "ml", factor: 1 },
  "ליטר": { base: "ml", factor: 1000 },
  "ל": { base: "ml", factor: 1000 },
  "l": { base: "ml", factor: 1000 },
  "יח׳": { base: "unit", factor: 1 },
  "יח'": { base: "unit", factor: 1 },
  "יחידה": { base: "unit", factor: 1 },
  "יחידות": { base: "unit", factor: 1 },
  "": { base: "unit", factor: 1 },
};

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").replace(/[״"']/g, "").toLowerCase();
}

export function normalizeUnit(unit: string): { base: string; factor: number } {
  const u = unit.trim().toLowerCase();
  return UNIT_TABLE[u] ?? { base: u, factor: 1 };
}

export function groceryKey(name: string, unit: string): string {
  return `${normalizeName(name)}|${normalizeUnit(unit).base}`;
}

/** Present a base quantity in a friendly unit. */
export function presentQuantity(base: string, qty: number): { quantity: number; unit: string } {
  const r = (n: number) => Math.round(n * 100) / 100;
  if (base === "g") return qty >= 1000 ? { quantity: r(qty / 1000), unit: "ק״ג" } : { quantity: r(qty), unit: "גרם" };
  if (base === "ml") return qty >= 1000 ? { quantity: r(qty / 1000), unit: "ליטר" } : { quantity: r(qty), unit: "מ״ל" };
  if (base === "unit") return { quantity: r(qty), unit: "יח׳" };
  return { quantity: r(qty), unit: base };
}

export interface AggregatedItem {
  key: string;
  name: string;
  quantity: number;
  unit: string;
  meals: string[];
}

/**
 * Sum the ingredients of every planned meal (scaled by planned portions / recipe portions),
 * merging the same ingredient across meals and compatible units, then subtract the pantry.
 */
export function aggregateIngredients(
  entries: MealPlanEntry[],
  meals: Record<string, Meal>,
  pantry: PantryItem[] = [],
): AggregatedItem[] {
  const acc = new Map<string, { name: string; base: string; qty: number; meals: Set<string> }>();
  for (const e of entries) {
    const meal = meals[e.mealId];
    if (!meal) continue;
    const scale = e.portions / Math.max(1, meal.portions);
    for (const ing of meal.ingredients) {
      const { base, factor } = normalizeUnit(ing.unit);
      const key = `${normalizeName(ing.name)}|${base}`;
      const cur = acc.get(key) ?? { name: ing.name.trim(), base, qty: 0, meals: new Set<string>() };
      cur.qty += ing.quantity * factor * scale;
      cur.meals.add(meal.name);
      acc.set(key, cur);
    }
  }
  for (const p of pantry) {
    const { base, factor } = normalizeUnit(p.unit);
    const key = `${normalizeName(p.name)}|${base}`;
    const cur = acc.get(key);
    if (cur) cur.qty -= p.quantity * factor;
  }
  const out: AggregatedItem[] = [];
  for (const [key, v] of acc) {
    if (v.qty <= 1e-9) continue;
    const { quantity, unit } = presentQuantity(v.base, v.qty);
    out.push({ key, name: v.name, quantity, unit, meals: [...v.meals] });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "he"));
}

export interface GroceryMerge {
  upserts: GroceryItem[];
  removeIds: string[];
}

/**
 * Merge a freshly aggregated list into the week's existing grocery list without
 * losing user data:
 * - same ingredient → update the plan quantity; keep purchased state and manual quantity adjustments
 * - manual item with the same name/unit → reused (no duplicate)
 * - plan items no longer needed → removed only if untouched (not purchased/adjusted)
 * - manual items are never removed
 */
export function mergeGroceryList(
  existing: GroceryItem[],
  aggregated: AggregatedItem[],
  weekStart: string,
  now: string,
  newId: () => string,
): GroceryMerge {
  const byKey = new Map<string, GroceryItem>();
  for (const it of existing) byKey.set(it.key || groceryKey(it.name, it.unit), it);
  const upserts: GroceryItem[] = [];
  const seen = new Set<string>();
  for (const a of aggregated) {
    seen.add(a.key);
    const cur = byKey.get(a.key);
    if (cur) {
      const next: GroceryItem = {
        ...cur,
        key: a.key,
        planQuantity: a.quantity,
        quantity: cur.adjusted ? cur.quantity : a.quantity,
        unit: cur.adjusted ? cur.unit : a.unit,
        updatedAt: now,
      };
      upserts.push(next);
    } else {
      upserts.push({
        id: newId(),
        weekStart,
        name: a.name,
        quantity: a.quantity,
        unit: a.unit,
        purchased: false,
        source: "plan",
        key: a.key,
        planQuantity: a.quantity,
        adjusted: false,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  const removeIds = existing
    .filter((it) => it.source === "plan" && !seen.has(it.key) && !it.purchased && !it.adjusted)
    .map((it) => it.id);
  return { upserts, removeIds };
}
