/** Dependencies-first order, stable by deadline. Cycles are broken (validation reports them). */
export function topoSortGeneric<T extends { key: string; deadline: string; dependsOn: string[] }>(items: T[]): T[] {
  const byKey = new Map(items.map((t) => [t.key, t]));
  const out: T[] = [];
  const state = new Map<string, 1 | 2>();
  const visit = (t: T) => {
    if (state.get(t.key)) return;
    state.set(t.key, 1);
    for (const d of t.dependsOn) {
      const dt = byKey.get(d);
      if (dt && !state.get(dt.key)) visit(dt);
    }
    state.set(t.key, 2);
    out.push(t);
  };
  items
    .slice()
    .sort((a, b) => (a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : 0))
    .forEach(visit);
  return out;
}

export function findCycleGeneric<T extends { key: string; title: string; dependsOn: string[] }>(items: T[]): string[] | null {
  const byKey = new Map(items.map((t) => [t.key, t]));
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];
  const visit = (k: string): string[] | null => {
    const s = state.get(k);
    if (s === 2) return null;
    if (s === 1) return [...stack.slice(stack.indexOf(k)), k];
    state.set(k, 1);
    stack.push(k);
    for (const d of byKey.get(k)?.dependsOn ?? []) {
      if (!byKey.has(d)) continue;
      const c = visit(d);
      if (c) return c;
    }
    stack.pop();
    state.set(k, 2);
    return null;
  };
  for (const t of items) {
    const c = visit(t.key);
    if (c) return c.map((k) => byKey.get(k)?.title ?? k);
  }
  return null;
}
