/** AETHERIA presentation state (title cards, journal, panels). No game rules here. */
import { create } from "zustand";

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
}

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
}));
