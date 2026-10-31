"use client";
import { create } from "zustand";
import type { Task } from "../types";
import type { TaskInstance } from "../tasks";

interface EditorReq {
  task?: Task;
  instance?: TaskInstance;
  defaults?: Partial<Task>;
}

interface UIState {
  editor: EditorReq | null;
  openEditor(req?: EditorReq): void;
  closeEditor(): void;
  reschedule: TaskInstance | null;
  openReschedule(i: TaskInstance | null): void;
  moreOpen: boolean;
  setMoreOpen(v: boolean): void;
}

export const useUI = create<UIState>((set) => ({
  editor: null,
  openEditor: (req = {}) => set({ editor: req }),
  closeEditor: () => set({ editor: null }),
  reschedule: null,
  openReschedule: (i) => set({ reschedule: i }),
  moreOpen: false,
  setMoreOpen: (v) => set({ moreOpen: v }),
}));
