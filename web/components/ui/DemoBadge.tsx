import { getDictionary } from "@/lib/i18n";

const dict = getDictionary();

/**
 * Marks fictional data (spec §62).
 *
 * Rendered on every surface that shows demo content so a demo figure can
 * never be read as a real one.
 */
export function DemoBadge() {
  return (
    <span className="inline-flex items-center rounded-md bg-warning/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-warning">
      {dict.common.demoBadge}
    </span>
  );
}
