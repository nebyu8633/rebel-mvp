import { formatAgorot } from "@/lib/format/currency";
import { formatMonthYear } from "@/lib/format/date";
import { baseUnitLabel } from "@/lib/i18n/units";
import { fromScaledUnitPrice } from "@/lib/savings/money";
import type { PricePoint } from "@/lib/dashboard/queries";

/**
 * A product's price over time (spec §38).
 *
 * Inline SVG rather than a charting library, for the same reason as the bar
 * chart: it mirrors correctly under RTL, where many chart libraries lay out
 * left-to-right regardless of document direction.
 *
 * Only ever rendered for products that actually have enough history — the
 * caller filters those out, so this never draws a line implying a trend that
 * the data does not contain.
 */
export function PriceTrendChart({
  productName,
  baseUnit,
  points,
}: {
  productName: string;
  baseUnit: string;
  points: readonly PricePoint[];
}) {
  if (points.length < 2) return null;

  const width = 320;
  const height = 90;
  const padding = 6;

  const prices = points.map((point) => point.unitPrice);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  // A flat series would divide by zero; give it a nominal range so the line
  // renders through the middle instead of collapsing.
  const range = max - min === 0 ? Math.max(1, max * 0.1) : max - min;

  // observedAt rides along as a stable, data-derived key for the dots below.
  const coordinates = points.map((point, index) => {
    const x = padding + (index / (points.length - 1)) * (width - padding * 2);
    const y =
      height - padding - ((point.unitPrice - min) / range) * (height - padding * 2);
    return { x, y, observedAt: point.observedAt };
  });

  const path = coordinates
    .map((c, index) => `${index === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");

  const first = points[0];
  const last = points[points.length - 1];
  const unit = baseUnitLabel(baseUnit);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate text-sm font-medium text-content">{productName}</p>
        <p
          dir="ltr"
          style={{ unicodeBidi: "isolate" }}
          className="tnum shrink-0 text-sm text-content"
        >
          {formatAgorot(Math.round(fromScaledUnitPrice(last!.unitPrice) * 100))}
          {unit !== null && <span className="text-content-subtle"> / {unit}</span>}
        </p>
      </div>

      {/*
       * The SVG is presentational; the dates and the current price above and
       * below give the same information as text.
       */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-3 h-[90px] w-full"
        preserveAspectRatio="none"
        // role="img" with aria-label is the standard accessible pattern for an
        // inline SVG; an <img> tag would require an external asset.
        // oxlint-disable-next-line prefer-tag-over-role
        role="img"
        aria-label={`${productName}: ${formatMonthYear(first!.observedAt)} – ${formatMonthYear(last!.observedAt)}`}
      >
        <path
          d={path}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {coordinates.map((c) => (
          <circle
            key={c.observedAt}
            cx={c.x}
            cy={c.y}
            r="2.5"
            fill="var(--color-accent)"
          />
        ))}
      </svg>

      <div className="mt-1 flex justify-between text-[11px] text-content-subtle">
        <span>{formatMonthYear(first!.observedAt)}</span>
        <span>{formatMonthYear(last!.observedAt)}</span>
      </div>
    </div>
  );
}
