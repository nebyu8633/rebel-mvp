/**
 * The Living Architect's appearance and equipment. Pure data + validation (no three).
 *
 * Identity: the same player as in LifeOS — display name and base look come (read-only) from the
 * LifeOS game profile. The fantasy loadout is AETHERIA state (saved by the save system, not the DB).
 *
 * Items render through a `visual` descriptor:
 *  - "procedural": a built-in mesh recipe attached to a canonical bone (works with any rig now);
 *  - "glb": a model file — rigid (attached to a bone) or skinned (bound to the shared skeleton).
 * Swapping the base body (placeholder -> personal avatar -> future model) doesn't touch items.
 */
export const SLOTS = ["head", "torso", "legs", "feet", "hands", "cloak", "neck", "shoulders", "mainHand", "offHand"] as const;
export type Slot = (typeof SLOTS)[number];

export type CanonicalBone = "head" | "neck" | "chest" | "leftHand" | "rightHand" | "leftUpperArm" | "rightUpperArm" | "hips";

export type ItemVisual =
  | { kind: "procedural"; recipe: string; bone: CanonicalBone; mirror?: CanonicalBone }
  | { kind: "glb"; url: string; skinned: boolean; bone?: CanonicalBone };

export interface ItemDef {
  id: string;
  name: string;
  slot: Slot;
  /** minimum visual-progression tier to equip */
  minTier: number;
  visual: ItemVisual;
}

export interface Loadout {
  /** which base body to use; "auto" = personal avatar if present, else the placeholder */
  base: "auto" | "placeholder" | "personal";
  equipped: Partial<Record<Slot, string>>;
  /** visual progression 0..3 (World Progress, never Life XP) */
  tier: number;
}

export const MAX_TIER = 3;
export const defaultLoadout = (): Loadout => ({ base: "auto", equipped: {}, tier: 0 });

/** Starter catalog: real, renderable items (procedural recipes in avatar/recipes.ts). */
export const ITEMS: ItemDef[] = [
  { id: "architect_staff", name: "מטה האדריכל", slot: "mainHand", minTier: 0, visual: { kind: "procedural", recipe: "staff", bone: "rightHand" } },
  { id: "origin_pendant", name: "תליון המקור", slot: "neck", minTier: 0, visual: { kind: "procedural", recipe: "pendant", bone: "chest" } },
  { id: "sentinel_pauldrons", name: "כותפות השומר", slot: "shoulders", minTier: 1, visual: { kind: "procedural", recipe: "pauldron", bone: "rightUpperArm", mirror: "leftUpperArm" } },
  { id: "wayfinder_lantern", name: "פנס מוצא הדרך", slot: "offHand", minTier: 0, visual: { kind: "procedural", recipe: "lantern", bone: "leftHand" } },
];
export const itemById = (id: string) => ITEMS.find((i) => i.id === id) ?? null;

export function validateLoadout(l: Loadout): string[] {
  const errs: string[] = [];
  if (!Number.isInteger(l.tier) || l.tier < 0 || l.tier > MAX_TIER) errs.push("tier out of range");
  for (const [slot, id] of Object.entries(l.equipped)) {
    if (!id) continue;
    const it = itemById(id);
    if (!it) errs.push(`unknown item ${id}`);
    else if (it.slot !== slot) errs.push(`${id} does not fit slot ${slot}`);
    else if (it.minTier > l.tier) errs.push(`${id} requires tier ${it.minTier}`);
  }
  return errs;
}

export type EquipResult = { ok: true; loadout: Loadout } | { ok: false; reason: string };

export function equip(l: Loadout, itemId: string): EquipResult {
  const it = itemById(itemId);
  if (!it) return { ok: false, reason: "unknown item" };
  if (it.minTier > l.tier) return { ok: false, reason: `requires tier ${it.minTier}` };
  return { ok: true, loadout: { ...l, equipped: { ...l.equipped, [it.slot]: it.id } } };
}
export const unequip = (l: Loadout, slot: Slot): Loadout => {
  const equipped = { ...l.equipped };
  delete equipped[slot];
  return { ...l, equipped };
};

// ---------------------------------------------------------------- identity (from LifeOS, read-only)
/** Subset of LifeOS GameProfile (lifeos/src/lib/types.ts) the game reads. */
export interface ProfileIdentity {
  displayName: string;
  avatar: { skin: number; outfit: number; accent: number; emblem: number };
}
const ACCENTS = ["#4fc3ff", "#f5b301", "#22c55e", "#ff5ea8", "#8b5cf6", "#14b8a6"];

export function architectIdentity(p: ProfileIdentity | null) {
  const accentIdx = p ? Math.min(ACCENTS.length - 1, Math.max(0, p.avatar.accent)) : 0;
  return { displayName: p?.displayName?.trim() || "האדריכל החי", accent: ACCENTS[accentIdx], emblem: p?.avatar.emblem ?? 0 };
}
