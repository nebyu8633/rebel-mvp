/**
 * Name normalization for supplier and product matching.
 *
 * Ported from the Python service (`app/guard/matching.py`). Deliberately
 * conservative: it strips noise (diacritics, punctuation, case, extra
 * whitespace) but never reorders words, stems, or transliterates. Two names
 * only match if they are genuinely the same string once the noise is gone.
 *
 * "חזה עוף 5 ק״ג" and "עוף חזה 5KG" must NOT normalize to the same value —
 * claiming they are the same product would produce a false price alert.
 */

/** Hebrew niqqud (vowel points) and cantillation marks. */
const NIQQUD = /[֑-ׇ]/g;

/**
 * Punctuation to drop, including the Hebrew geresh/gershayim used inside
 * abbreviations (ק״ג, יח׳) and their typographic lookalikes.
 */
const PUNCTUATION = /["'׳״‘’“”.,()\-_/\\]/g;

const WHITESPACE = /\s+/g;

/**
 * A digit immediately followed by a letter, as in "10KG".
 *
 * Whether a supplier writes "10KG" or "10 kg" is pure formatting, so a space
 * is inserted to make the two normalize alike (spec §20 names this exact
 * case). This is the one place this module differs from the Python service's
 * `normalize_name`, which predates that requirement.
 *
 * Only the digit->letter boundary is touched. Letter->digit is left alone:
 * "A5" and "A 5" are not obviously the same thing, and merging them would be
 * a guess.
 */
const DIGIT_LETTER_BOUNDARY = /(\d)(\p{L})/gu;

/**
 * Normalizes a supplier or product name to a stable matching key.
 *
 * NFKC first so that composed/decomposed Hebrew and full-width Latin collapse
 * to one representation before anything else is stripped.
 */
export function normalizeName(rawName: string): string {
  return rawName
    .normalize("NFKC")
    .replace(NIQQUD, "")
    .replace(PUNCTUATION, " ")
    .replace(DIGIT_LETTER_BOUNDARY, "$1 $2")
    .toLowerCase()
    .trim()
    .replace(WHITESPACE, " ");
}
