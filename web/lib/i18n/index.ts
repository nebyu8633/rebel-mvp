import { he, type Dictionary } from "./he";

export type Locale = "he" | "en";

/** V1 ships Hebrew only; the direction is a property of the locale, not a toggle. */
export const DEFAULT_LOCALE: Locale = "he";

export const LOCALE_DIRECTION: Record<Locale, "rtl" | "ltr"> = {
  he: "rtl",
  en: "ltr",
};

/**
 * Returns the active dictionary. Hebrew is the only complete dictionary in V1,
 * so every locale resolves to it until English is filled in.
 */
export function getDictionary(_locale: Locale = DEFAULT_LOCALE): Dictionary {
  return he;
}

export { he };
export type { Dictionary };
