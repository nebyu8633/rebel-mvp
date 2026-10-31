import { describe, expect, it } from "vitest";
import { aggregateIngredients, mergeGroceryList, groceryKey } from "../grocery";
import type { Meal, MealPlanEntry, GroceryItem } from "../types";
import { T0 } from "./helpers";

const meal = (id: string, portions: number, ingredients: Meal["ingredients"]): Meal => ({ id, name: id, portions, ingredients, prepNotes: "", createdAt: T0, updatedAt: T0 });
const entry = (id: string, mealId: string, portions: number): MealPlanEntry => ({ id, date: "2026-11-02", slot: "lunch", mealId, portions, prepDate: null, prepared: false, createdAt: T0, updatedAt: T0 });

describe("grocery aggregation", () => {
  const meals = {
    rice: meal("אורז ועוף", 2, [
      { name: "אורז", quantity: 300, unit: "גרם" },
      { name: "חזה עוף", quantity: 0.5, unit: "ק״ג" },
    ]),
    bowl: meal("קערת עוף", 1, [
      { name: " חזה  עוף ", quantity: 250, unit: "גרם" },
      { name: "ביצים", quantity: 2, unit: "יח׳" },
    ]),
  };

  it("merges the same ingredient across meals and units without duplicates", () => {
    const items = aggregateIngredients([entry("1", "rice", 2), entry("2", "bowl", 1), entry("3", "bowl", 2)], meals);
    const chicken = items.filter((i) => i.name.includes("עוף"));
    expect(chicken).toHaveLength(1);
    // 500g (rice x1 batch) + 250g*3 = 1250g
    expect(chicken[0]).toMatchObject({ quantity: 1.25, unit: "ק״ג" });
    expect(items.find((i) => i.name === "ביצים")).toMatchObject({ quantity: 6, unit: "יח׳" });
    expect(items.find((i) => i.name === "אורז")).toMatchObject({ quantity: 300, unit: "גרם" });
  });

  it("scales by planned portions vs recipe portions", () => {
    const items = aggregateIngredients([entry("1", "rice", 4)], meals);
    expect(items.find((i) => i.name === "אורז")?.quantity).toBe(600);
  });

  it("subtracts pantry stock", () => {
    const items = aggregateIngredients([entry("1", "bowl", 3)], meals, [
      { id: "p", name: "ביצים", quantity: 6, unit: "יחידות", createdAt: T0, updatedAt: T0 },
    ]);
    expect(items.find((i) => i.name === "ביצים")).toBeUndefined();
  });

  it("re-generating keeps purchased state, manual adjustments and manual items", () => {
    const agg = aggregateIngredients([entry("1", "rice", 2)], meals);
    let n = 0;
    const first = mergeGroceryList([], agg, "2026-11-01", T0, () => `id${++n}`);
    expect(first.upserts).toHaveLength(2);
    const list: GroceryItem[] = first.upserts.map((u) => (u.name === "אורז" ? { ...u, purchased: true } : { ...u, quantity: 2, adjusted: true }));
    list.push({ id: "manual", weekStart: "2026-11-01", name: "חלב", quantity: 1, unit: "ליטר", purchased: false, source: "manual", key: groceryKey("חלב", "ליטר"), planQuantity: null, adjusted: false, createdAt: T0, updatedAt: T0 });
    const agg2 = aggregateIngredients([entry("1", "rice", 4)], meals);
    const second = mergeGroceryList(list, agg2, "2026-11-01", T0, () => `id${++n}`);
    expect(second.upserts).toHaveLength(2);
    const rice = second.upserts.find((u) => u.name === "אורז")!;
    expect(rice.purchased).toBe(true);
    expect(rice.quantity).toBe(600);
    const chicken = second.upserts.find((u) => u.name.includes("עוף"))!;
    expect(chicken.quantity).toBe(2); // user adjustment kept
    expect(chicken.planQuantity).toBe(1);
    expect(second.removeIds).toEqual([]);
  });

  it("removes untouched plan items that are no longer needed, never manual ones", () => {
    const agg = aggregateIngredients([entry("1", "bowl", 1)], meals);
    let n = 0;
    const first = mergeGroceryList([], agg, "2026-11-01", T0, () => `id${++n}`).upserts;
    const second = mergeGroceryList(first, [], "2026-11-01", T0, () => `x`);
    expect(second.removeIds.sort()).toEqual(first.map((f) => f.id).sort());
  });
});
