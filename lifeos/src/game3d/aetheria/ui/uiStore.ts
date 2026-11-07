/** AETHERIA presentation state (title cards, journal, panels). No game rules here. */
import { create } from "zustand";
import type { Force } from "../core/model";

export interface Card {
  title: string;
  body?: string;
  tone?: "discovery" | "resonance" | "echo";
}

interface UiState {
  card: Card | null;
  queue: Card[];
  panel: null | "journal" | "kingdoms";
  showCard(c: Card): void;
  nextCard(): void;
  setPanel(p: UiState["panel"]): void;
  /** the resonance power the player has ready (chosen in the power bar) */
  power: Force | null;
  setPower(f: Force | null): void;
  /** short in-world feedback line (e.g. why a power had no effect) */
  hint: { text: string; id: number } | null;
  say(text: string): void;
}

let hintTimer: ReturnType<typeof setTimeout> | null = null;

export const useAetheriaUi = create<UiState>((set, get) => ({
  card: null,
  queue: [],
  panel: null,
  showCard(c) {
    if (get().card) set({ queue: [...get().queue, c] });
    else set({ card: c });
  },
  nextCard() {
    const [n, ...rest] = get().queue;
    set({ card: n ?? null, queue: rest });
  },
  setPanel: (panel) => set({ panel }),
  power: null,
  setPower: (power) => set({ power }),
  hint: null,
  say(text) {
    if (hintTimer) clearTimeout(hintTimer);
    set({ hint: { text, id: (get().hint?.id ?? 0) + 1 } });
    hintTimer = setTimeout(() => set({ hint: null }), 3800);
  },
}));
