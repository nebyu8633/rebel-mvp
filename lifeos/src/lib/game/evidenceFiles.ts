"use client";
/**
 * Private storage for evidence photos.
 * - Cloud mode: Supabase Storage bucket "evidence" (private), path "<uid>/<evidenceId>.jpg".
 *   Storage policies only allow the owner's own folder. Images are shown via short-lived
 *   signed URLs that are never persisted.
 * - Local mode: IndexedDB on this device only.
 * The database stores only the opaque path (fileRef), never a public URL.
 */
import { getBrowserSupabase } from "../supabase/client";
import { useStore } from "../store/store";

const DB_NAME = "lifeos-evidence";
const STORE = "files";

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(key: string, blob: Blob) {
  const db = await idb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGet(key: string): Promise<Blob | null> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const r = tx.objectStore(STORE).get(key);
    r.onsuccess = () => resolve((r.result as Blob) ?? null);
    r.onerror = () => reject(r.error);
  });
}
async function idbDelete(key: string) {
  const db = await idb();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/** Downscale + re-encode to JPEG (strips EXIF/location metadata as a side effect). */
export async function compressImage(file: Blob, maxSide = 1280, quality = 0.82): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error("לא ניתן לקרוא את התמונה");
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("דחיסה נכשלה"))), "image/jpeg", quality));
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

async function cloudUser() {
  const sb = getBrowserSupabase();
  if (!sb || useStore.getState().mode !== "supabase") return null;
  const { data } = await sb.auth.getUser();
  return data.user ? { sb, uid: data.user.id } : null;
}

/** Stores the image privately and returns its opaque reference. */
export async function saveEvidenceFile(evidenceId: string, blob: Blob): Promise<string> {
  const cloud = await cloudUser();
  if (cloud) {
    const path = `${cloud.uid}/${evidenceId}.jpg`;
    const { error } = await cloud.sb.storage.from("evidence").upload(path, blob, { contentType: "image/jpeg", upsert: true });
    if (error) throw new Error("העלאת התמונה נכשלה: " + error.message);
    return `sb:${path}`;
  }
  const key = `local:${evidenceId}`;
  await idbPut(key, blob);
  return key;
}

const urlCache = new Map<string, { url: string; until: number }>();

/** A temporary URL to display the image (object URL locally, 10-minute signed URL in the cloud). */
export async function evidenceFileUrl(ref: string): Promise<string | null> {
  const c = urlCache.get(ref);
  if (c && c.until > Date.now()) return c.url;
  let url: string | null = null;
  if (ref.startsWith("sb:")) {
    const sb = getBrowserSupabase();
    if (!sb) return null;
    const { data } = await sb.storage.from("evidence").createSignedUrl(ref.slice(3), 600);
    url = data?.signedUrl ?? null;
    if (url) urlCache.set(ref, { url, until: Date.now() + 540_000 });
  } else if (ref.startsWith("local:")) {
    const blob = await idbGet(ref).catch(() => null);
    url = blob ? URL.createObjectURL(blob) : null;
    if (url) urlCache.set(ref, { url, until: Number.MAX_SAFE_INTEGER });
  }
  return url;
}

export async function deleteEvidenceFile(ref: string) {
  urlCache.delete(ref);
  if (ref.startsWith("sb:")) await getBrowserSupabase()?.storage.from("evidence").remove([ref.slice(3)]);
  else if (ref.startsWith("local:")) await idbDelete(ref);
}
