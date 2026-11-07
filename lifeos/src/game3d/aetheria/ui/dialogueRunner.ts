/**
 * Runs a conversation: shows nodes, applies each node's / choice's actions through the rules engine
 * (via the AETHERIA store), and closes at the end. UI-agnostic; the HUD renders `useDialogue`.
 */
import { create } from "zustand";
import { choose, enterActions, viewNode, type DialogueDef, type NodeView } from "../core/dialogue";
import { useAetheria } from "../store";
import { ECHO_TALK, FIRST_TOUCH } from "../content/echoAwakening";

const REGISTRY: Record<string, DialogueDef> = { [FIRST_TOUCH.id]: FIRST_TOUCH, [ECHO_TALK.id]: ECHO_TALK };

interface DialogueState {
  defId: string | null;
  nodeId: string | null;
  view: NodeView | null;
  open(def: DialogueDef): void;
  pick(choiceId: string | null): void;
  close(): void;
}

function enter(def: DialogueDef, nodeId: string) {
  useAetheria.getState().dispatch(enterActions(def, nodeId));
  return viewNode(def, nodeId, useAetheria.getState().world);
}

export const useDialogue = create<DialogueState>((set, get) => ({
  defId: null,
  nodeId: null,
  view: null,
  open(def) {
    if (get().defId) return;
    set({ defId: def.id, nodeId: def.start, view: enter(def, def.start) });
  },
  pick(choiceId) {
    const { defId, nodeId } = get();
    const def = defId ? REGISTRY[defId] : null;
    if (!def || !nodeId) return;
    const r = choose(def, nodeId, choiceId, useAetheria.getState().world);
    if (!r.ok) return;
    if (r.actions.length) useAetheria.getState().dispatch(r.actions);
    if (r.next === null) return set({ defId: null, nodeId: null, view: null });
    set({ nodeId: r.next, view: enter(def, r.next) });
  },
  close: () => set({ defId: null, nodeId: null, view: null }),
}));
