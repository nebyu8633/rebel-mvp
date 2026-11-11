/**
 * The Origin Fragment's evolution (visual bible §3.4). The stage is DERIVED from story progress the
 * rules engine already validated, so it can never get out of sync with the world and needs no
 * extra save data:
 *   dormant        before the player touches it
 *   awakening      touched (the Echo appears)
 *   attunement     the First Resonance happened (the six kingdoms answer)
 *   convergence    the Living Architect has learned all three forces
 *   transcendence  the Future Echo became whole (the gate woke)
 * Gameplay follows the same ladder: touching → aligning the rings → learning the forces happen at
 * the fragment's astrolabe in this order.
 */
import { FORCES } from "../core/model";
import type { WorldState } from "../core/state";
import { F } from "./firstResonance";

export const FRAGMENT_STAGES = ["dormant", "awakening", "attunement", "convergence", "transcendence"] as const;
export type FragmentStage = (typeof FRAGMENT_STAGES)[number];
export const FRAGMENT_TITLES: Record<FragmentStage, string> = {
  dormant: "רדום",
  awakening: "התעוררות",
  attunement: "כוונון",
  convergence: "התכנסות",
  transcendence: "התעלות",
};

export function fragmentStage(s: WorldState): FragmentStage {
  if (s.echo === "future_companion") return "transcendence";
  if (FORCES.every((f) => (s.powers ?? []).includes(f))) return "convergence";
  if (s.flags.includes(F.resonance)) return "attunement";
  if (s.flags.includes(F.fragment)) return "awakening";
  return "dormant";
}
