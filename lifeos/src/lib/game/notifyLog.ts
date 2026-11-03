"use client";
/** Per-device delivery log: what was actually shown, when, and through which channel. */
export interface LogEntry {
  key: string;
  title: string;
  /** Scheduled wall-clock time (HH:MM) and date in the user's zone. */
  date: string;
  time: string;
  deliveredAt: number;
  channels: Array<"inapp" | "browser" | "sound" | "push-device">;
  note?: string;
}
const KEY = "lifeos:notify-log:v1";

export function readLog(): LogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function appendLog(e: LogEntry) {
  try {
    const list = readLog().filter((x) => Date.now() - x.deliveredAt < 3 * 86_400_000);
    list.push(e);
    localStorage.setItem(KEY, JSON.stringify(list.slice(-200)));
    window.dispatchEvent(new Event("lifeos:notify-log"));
  } catch {
    /* storage unavailable */
  }
}
