"use client";
/** Game-layer mutations. All go through the store (validated, persisted, rolled back on failure). */
import { useStore } from "../store/store";
import { nowIso, uid } from "../actions";
import type { Evidence, GameProfile, Reward } from "../types";
import type { TaskInstance } from "../tasks";
import { defaultProfile, profileOf } from "./engine";
import { blobToBase64, deleteEvidenceFile, saveEvidenceFile } from "./evidenceFiles";
import { aiConfigured } from "../ai/client";

const S = () => useStore.getState();

export async function updateProfile(patch: Partial<GameProfile>, today: string): Promise<boolean> {
  const cur = profileOf(S().db) ?? defaultProfile(today, nowIso());
  return S().put("gameProfile", { ...cur, ...patch, id: "profile", updatedAt: nowIso() });
}

export interface EvidenceDraft {
  kind: Evidence["kind"];
  blob: Blob | null;
  note: string;
}

/**
 * Store the evidence privately and (for photos) ask the AI for a RELEVANCE hint.
 * Never auto-accepts: the player confirms. Returns the saved record.
 */
export async function submitEvidence(inst: TaskInstance, draft: EvidenceDraft): Promise<Evidence | null> {
  const id = uid();
  const n = nowIso();
  let fileRef: string | null = null;
  if (draft.blob) {
    try {
      fileRef = await saveEvidenceFile(id, draft.blob);
    } catch (e) {
      S().toast(e instanceof Error ? e.message : "שמירת התמונה נכשלה", "error");
      return null;
    }
  }
  const ev: Evidence = {
    id,
    taskId: inst.task.id,
    instanceKey: inst.key,
    status: draft.kind === "manual" ? "manual" : "submitted",
    kind: draft.kind,
    fileRef,
    note: draft.note.trim().slice(0, 1000),
    aiVerdict: null,
    aiReason: "",
    submittedAt: n,
    decidedAt: draft.kind === "manual" ? n : null,
    createdAt: n,
    updatedAt: n,
  };
  if (!(await S().put("evidence", ev))) {
    if (fileRef) await deleteEvidenceFile(fileRef).catch(() => {});
    return null;
  }
  return ev;
}

/** Ask the AI whether the photo looks relevant. Updates the record to "review". */
export async function assessEvidence(ev: Evidence, blob: Blob, taskTitle: string, criteria: string): Promise<Evidence> {
  let next: Evidence;
  if (!(await aiConfigured())) {
    next = { ...ev, status: "review", aiVerdict: null, aiReason: "בדיקת AI לא זמינה כרגע. אפשר לאשר ידנית.", updatedAt: nowIso() };
  } else {
    try {
      const res = await fetch("/api/ai/evidence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskTitle, criteria, imageBase64: await blobToBase64(blob), mediaType: "image/jpeg" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) next = { ...ev, status: "review", aiReason: j.error ?? "בדיקת AI לא הצליחה. אפשר לאשר ידנית.", updatedAt: nowIso() };
      else next = { ...ev, status: j.verdict === "likely" ? "review" : "more", aiVerdict: j.verdict, aiReason: String(j.reason ?? "").slice(0, 600), updatedAt: nowIso() };
    } catch {
      next = { ...ev, status: "review", aiReason: "אין חיבור לבדיקת AI. אפשר לאשר ידנית.", updatedAt: nowIso() };
    }
  }
  await S().put("evidence", next);
  return next;
}

/** The player's decision. "accepted" = confirmed after review, "manual" = confirmed without AI support. */
export async function decideEvidence(ev: Evidence, status: "accepted" | "manual" | "more"): Promise<boolean> {
  const n = nowIso();
  return S().put("evidence", { ...ev, status, decidedAt: status === "more" ? null : n, updatedAt: n });
}

export async function deleteEvidence(ev: Evidence) {
  const ok = await S().remove("evidence", ev.id);
  if (ok && ev.fileRef) await deleteEvidenceFile(ev.fileRef).catch(() => {});
  return ok;
}

export async function openChest(milestoneId: string, today: string) {
  const p = profileOf(S().db) ?? defaultProfile(today, nowIso());
  if (p.chestsOpened.includes(milestoneId)) return true;
  return updateProfile({ chestsOpened: [...p.chestsOpened, milestoneId] }, today);
}

export async function saveReward(r: Omit<Reward, "id" | "createdAt" | "updatedAt" | "claimedAt"> & { id?: string; claimedAt?: string | null }) {
  const n = nowIso();
  const prev = r.id ? S().db.rewards[r.id] : null;
  return S().put("rewards", { claimedAt: null, ...prev, ...r, id: r.id ?? uid(), createdAt: prev?.createdAt ?? n, updatedAt: n });
}

export async function claimReward(r: Reward) {
  return S().put("rewards", { ...r, claimedAt: r.claimedAt ? null : nowIso(), updatedAt: nowIso() });
}

export async function deleteReward(id: string) {
  return S().remove("rewards", id);
}
