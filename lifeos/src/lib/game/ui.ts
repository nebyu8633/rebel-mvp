"use client";
import { create } from "zustand";

/** Game overlays that can be opened from anywhere (world HUD, quest map, reminders…). */
interface GameOverlays {
  /** Focus Mode for a task instance key. */
  focusKey: string | null;
  openFocus(key: string | null): void;
  /** Evidence submission for a task instance key; `complete` = mark the task done on submit. */
  evidence: { key: string; complete: boolean } | null;
  openEvidence(key: string | null, complete?: boolean): void;
  gmOpen: boolean;
  setGmOpen(v: boolean): void;
  introOpen: boolean;
  setIntroOpen(v: boolean): void;
}

export const useGameUI = create<GameOverlays>((set) => ({
  focusKey: null,
  openFocus: (focusKey) => set({ focusKey }),
  evidence: null,
  openEvidence: (key, complete = true) => set({ evidence: key ? { key, complete } : null }),
  gmOpen: false,
  setGmOpen: (gmOpen) => set({ gmOpen }),
  introOpen: false,
  setIntroOpen: (introOpen) => set({ introOpen }),
}));
