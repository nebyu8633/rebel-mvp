import { Ltr } from "@/components/ui/Ltr";
import type { OpportunityWithNames } from "@/lib/dashboard/queries";
import { formatAgorot, formatSignedPercent } from "@/lib/format/currency";
import { getDictionary } from "@/lib/i18n";
import { baseUnitLabel } from "@/lib/i18n/units";
import { fromScaledUnitPrice } from "@/lib/savings/money";

const dict = getDictionary();

/**
 * Top opportunities, as a table on wide screens and stacked cards on narrow
 * ones — a seven-column table is unusable on a phone.
 */
export function OpportunityList({ rows }: { rows: readonly OpportunityWithNames[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-border sm:block">
        <table className="w-full min-w-[44rem] text-start text-sm">
          <thead className="border-b border-border bg-surface-2/50">
            <tr>
              <Th>{dict.results.columns.product}</Th>
              <Th>{dict.results.columns.supplier}</Th>
              <Th>{dict.results.columns.currentPrice}</Th>
              <Th>{dict.results.columns.referencePrice}</Th>
              <Th>{dict.results.columns.opportunity}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const unit = baseUnitLabel(row.base_unit);
              return (
                <tr key={row.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-medium text-content">
                    {row.products?.canonical_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-content-muted">
                    {row.suppliers?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Price scaled={row.current_unit_price} unit={unit} />
                  </td>
                  <td className="px-4 py-3 text-content-muted">
                    <Price scaled={row.reference_unit_price} unit={unit} />
                  </td>
                  <td className="px-4 py-3 font-semibold text-accent">
                    <Ltr>{formatAgorot(row.annual_opportunity_agorot, true)}</Ltr>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 sm:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate text-sm font-medium text-content">
                {row.products?.canonical_name ?? "—"}
              </p>
              <p className="tnum shrink-0 text-sm font-semibold text-accent">
                <Ltr>{formatAgorot(row.annual_opportunity_agorot, true)}</Ltr>
              </p>
            </div>
            <p className="mt-1 text-xs text-content-muted">
              {row.suppliers?.name ?? "—"}
              {row.percentage_change !== null && (
                <>
                  {" · "}
                  <span className="text-warning">
                    <Ltr>{formatSignedPercent(row.percentage_change)}</Ltr>
                  </span>
                </>
              )}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="px-4 py-3 text-start font-medium text-content-muted">
      {children}
    </th>
  );
}

function Price({ scaled, unit }: { scaled: number; unit: string | null }) {
  return (
    <span dir="ltr" style={{ unicodeBidi: "isolate" }} className="tnum">
      {formatAgorot(Math.round(fromScaledUnitPrice(scaled) * 100))}
      {unit !== null && <span className="text-content-subtle"> / {unit}</span>}
    </span>
  );
}
