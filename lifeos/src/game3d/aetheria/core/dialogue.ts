/**
 * Dialogue: authored, data-driven conversations (not a chatbot). Each node picks the first line
 * whose condition holds (narrative memory makes the same conversation read differently), offers
 * the choices whose conditions hold, and proposes actions. Actions are applied by the caller
 * through the rules engine, so a dialogue can never change the world in an invalid way.
 */
import { isLifeFlag } from "./model";
import { check, referencedFlags, type Action, type Condition, type WorldState } from "./state";

export type Speaker = "echo" | "narrator";

export interface DialogueLine {
  text: string;
  when?: Condition;
}
export interface DialogueChoice {
  id: string;
  text: string;
  when?: Condition;
  actions?: Action[];
  /** next node id; null ends the conversation */
  next: string | null;
}
export interface DialogueNode {
  speaker: Speaker;
  lines: DialogueLine[];
  /** applied when the node is shown */
  actions?: Action[];
  /** either choices, or an automatic `next` ("continue") */
  choices?: DialogueChoice[];
  next?: string | null;
}
export interface DialogueDef {
  id: string;
  start: string;
  /** main-story conversation: must not depend on real-life flags */
  essential: boolean;
  nodes: Record<string, DialogueNode>;
}

export interface NodeView {
  id: string;
  speaker: Speaker;
  text: string;
  choices: { id: string; text: string }[];
  /** true when the node has no choices and continues (or ends) on tap */
  continues: boolean;
  ends: boolean;
}

export function viewNode(def: DialogueDef, nodeId: string, s: WorldState): NodeView | null {
  const n = def.nodes[nodeId];
  if (!n) return null;
  const line = n.lines.find((l) => !l.when || check(s, l.when)) ?? n.lines[n.lines.length - 1];
  const choices = (n.choices ?? []).filter((c) => !c.when || check(s, c.when)).map((c) => ({ id: c.id, text: c.text }));
  const ends = !choices.length && (n.next === undefined || n.next === null);
  return { id: nodeId, speaker: n.speaker, text: line?.text ?? "", choices, continues: !choices.length, ends };
}

/** Actions to apply when entering a node. */
export const enterActions = (def: DialogueDef, nodeId: string): Action[] => def.nodes[nodeId]?.actions ?? [];

/** Resolve a choice (or "continue" with choiceId = null). Unknown/unavailable choices are rejected. */
export function choose(def: DialogueDef, nodeId: string, choiceId: string | null, s: WorldState): { ok: true; actions: Action[]; next: string | null } | { ok: false; reason: string } {
  const n = def.nodes[nodeId];
  if (!n) return { ok: false, reason: "unknown node" };
  if (choiceId === null) {
    if (n.choices?.some((c) => !c.when || check(s, c.when))) return { ok: false, reason: "a choice is required" };
    return { ok: true, actions: [], next: n.next ?? null };
  }
  const c = n.choices?.find((x) => x.id === choiceId);
  if (!c || (c.when && !check(s, c.when))) return { ok: false, reason: "choice not available" };
  return { ok: true, actions: c.actions ?? [], next: c.next };
}

export function validateDialogue(def: DialogueDef): string[] {
  const errs: string[] = [];
  if (!def.nodes[def.start]) errs.push(`${def.id}: missing start node`);
  for (const [id, n] of Object.entries(def.nodes)) {
    if (!n.lines.length) errs.push(`${def.id}.${id}: no lines`);
    if (n.lines.length && n.lines[n.lines.length - 1].when) errs.push(`${def.id}.${id}: last line must be unconditional (fallback)`);
    for (const c of n.choices ?? []) {
      if (c.next !== null && !def.nodes[c.next]) errs.push(`${def.id}.${id}.${c.id}: unknown next ${c.next}`);
    }
    if (n.next && !def.nodes[n.next]) errs.push(`${def.id}.${id}: unknown next ${n.next}`);
    // every node with choices must keep at least one unconditional choice, so nobody gets stuck
    if (n.choices?.length && n.choices.every((c) => c.when)) errs.push(`${def.id}.${id}: all choices are conditional`);
  }
  if (def.essential) {
    // conditional *lines* may react to real life (optional flavour); choices/progress may not
    const choiceConds = Object.values(def.nodes).flatMap((n) => (n.choices ?? []).map((c) => c.when).filter((x): x is Condition => !!x));
    const blocking = choiceConds.flatMap(referencedFlags).filter(isLifeFlag);
    if (blocking.length) errs.push(`${def.id}: essential dialogue gates choices on real-life flags (${blocking.join(", ")})`);
  }
  return errs;
}
