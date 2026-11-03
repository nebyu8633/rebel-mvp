/**
 * English (en-US) scaffold.
 *
 * V1 ships Hebrew only. This file exists so that adding English later is a
 * matter of filling in a dictionary that already type-checks against the
 * Hebrew one — not refactoring every component.
 *
 * `Partial<Dictionary>` deliberately: an incomplete English dictionary must
 * not compile as if it were complete. When English is activated, widen this
 * to the full `Dictionary` type and the compiler will list every missing key.
 */
import type { Dictionary } from "./he";

export const en: Partial<Dictionary> = {};
