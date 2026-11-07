/**
 * AETHERIA runtime store (separate from the engine/city store). Every world change goes through the
 * rules engine (core/state.ts); every change is autosaved through a SaveStore (local in this phase).
 */
import { create } from "zustand";
import { applyAll, initialWorldState, type Action, type WorldState } from "./core/state";
import { applyLifeEvent, emptyLedger, type EnrichmentLedger, type EnrichmentRule } from "./core/enrichment";
import { defaultLoadout, equip, unequip, validateLoadout, MAX_TIER, type Loadout, type Slot } from "../avatar/loadout";
import { LocalSaveStore, MemoryKV, type SaveStore } from "../save/saveStore";

interface AetheriaState {
  hydrated: boolean;
  world: WorldState;
  loadout: Loadout;
  enrichment: EnrichmentLedger;
  /** last rejection from the rules engine (for debugging / UI feedback) */
  lastRejection: string | null;
  dispatch(actions: Action[]): boolean;
  equipItem(id: string): boolean;
  unequipSlot(slot: Slot): void;
  setTier(tier: number): void;
  ingestLifeEvent(raw: unknown, rules: EnrichmentRule[]): string | null;
  hydrate(): Promise<void>;
  reset(): Promise<void>;
}

let saveStore: SaveStore = new LocalSaveStore(typeof localStorage !== "undefined" ? localStorage : new MemoryKV());
/** Swap the persistence backend (tests, or a future server store after approval). */
export function setSaveStore(s: SaveStore) {
  saveStore = s;
}

let pending: ReturnType<typeof setTimeout> | null = null;
function scheduleSave() {
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    const { world, loadout, enrichment, hydrated } = useAetheria.getState();
    if (hydrated) void saveStore.save({ world, loadout, enrichment });
  }, 250);
}
/** Write immediately (e.g. before a world transition or page hide). */
export async function flushSave() {
  if (pending) clearTimeout(pending);
  pending = null;
  const { world, loadout, enrichment, hydrated } = useAetheria.getState();
  if (hydrated) await saveStore.save({ world, loadout, enrichment });
}

export const useAetheria = create<AetheriaState>((set, get) => ({
  hydrated: false,
  world: initialWorldState(),
  loadout: defaultLoadout(),
  enrichment: emptyLedger(),
  lastRejection: null,
  dispatch(actions) {
    const r = applyAll(get().world, actions);
    if (!r.ok) {
      set({ lastRejection: r.reason });
      return false;
    }
    if (r.changed) {
      set({ world: r.state, lastRejection: null });
      scheduleSave();
    }
    return true;
  },
  equipItem(id) {
    const r = equip(get().loadout, id);
    if (!r.ok) {
      set({ lastRejection: r.reason });
      return false;
    }
    set({ loadout: r.loadout });
    scheduleSave();
    return true;
  },
  unequipSlot(slot) {
    set({ loadout: unequip(get().loadout, slot) });
    scheduleSave();
  },
  setTier(tier) {
    const t = Math.max(0, Math.min(MAX_TIER, Math.round(tier)));
    const l = { ...get().loadout, tier: t };
    // items above the new tier are unequipped rather than leaving an invalid loadout
    const equipped = { ...l.equipped };
    for (const err of validateLoadout(l)) {
      const id = /^(\S+) requires tier/.exec(err)?.[1];
      if (id) for (const [slot, v] of Object.entries(equipped)) if (v === id) delete equipped[slot as Slot];
    }
    set({ loadout: { ...l, equipped } });
    scheduleSave();
  },
  ingestLifeEvent(raw, rules) {
    const r = applyLifeEvent(get().world, get().enrichment, raw, rules);
    if (r.rejected) {
      set({ lastRejection: r.rejected });
      return null;
    }
    set({ world: r.state, enrichment: r.ledger });
    scheduleSave();
    return r.granted ?? r.revoked;
  },
  async hydrate() {
    const data = await saveStore.load();
    if (data) set({ world: data.world as WorldState, loadout: data.loadout as Loadout, enrichment: data.enrichment, hydrated: true });
    else set({ hydrated: true });
  },
  async reset() {
    await saveStore.clear();
    set({ world: initialWorldState(), loadout: defaultLoadout(), enrichment: emptyLedger(), lastRejection: null });
  },
}));
