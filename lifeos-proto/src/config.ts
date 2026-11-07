/**
 * Environment config — the ONLY file that differs between this Vite prototype and the copy synced
 * into the LifeOS app (lifeos/scripts/sync-game3d.mjs writes its own version there).
 */
import esplanade from "@pmndrs/assets/hdri/esplanade.exr";
import sunset from "@pmndrs/assets/hdri/sunset.exr";
import dawn from "@pmndrs/assets/hdri/dawn.exr";

/** URL prefix of public files (assets/, basis/, avatar-private/). */
export const BASE: string = import.meta.env.BASE_URL;
/** Dev-only test hooks (window.__protoPlayer, window.__proto3d). */
export const DEV: boolean = import.meta.env.DEV;
export const HDRI = { day: esplanade, dusk: sunset, dawn };
/** Kiosk that emits sample (mock) verified events — prototype only. */
export const DEMO_EVENTS = true;
/** Live LifeOS data (read-only) — off by default; the prototype has no live provider. */
export const LIVE_DATA = false;
