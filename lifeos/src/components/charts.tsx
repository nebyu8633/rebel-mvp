"use client";
/**
 * Small dependency-free SVG charts. Real data only — they render nothing meaningful without records.
 * Colors: two-series charts use validated categorical slots (blue, orange); a single series uses the accent.
 * Each chart has a hover tooltip, a legend when ≥2 series, and an accessible data table.
 */
import { useId, useMemo, useRef, useState } from "react";
import { formatShortDate } from "@/lib/dates";

export const SERIES = ["var(--series-1)", "var(--series-2)"];

interface Point {
  x: string;
  y: number;
}
interface Series {
  label: string;
  color: string;
  points: Point[];
  dashed?: boolean;
}

const W = 600;
const H = 200;
const PAD = { t: 12, r: 12, b: 24, l: 52 };

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  const start = Math.floor(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) out.push(Math.round(v * 1000) / 1000);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
  return out;
}

export function Legend({ items }: { items: Array<{ label: string; color: string; dashed?: boolean }> }) {
  return (
    <div className="mb-2 flex flex-wrap gap-3 text-xs text-stone-600 dark:text-stone-300">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <svg width="18" height="8" aria-hidden>
            <line x1="1" y1="4" x2="17" y2="4" stroke={i.color} strokeWidth="2.5" strokeDasharray={i.dashed ? "4 3" : undefined} strokeLinecap="round" />
          </svg>
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function LineChart({ series, format = (v) => String(v), ariaLabel, yMin }: { series: Series[]; format?: (v: number) => string; ariaLabel: string; yMin?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const tableId = useId();
  const [hover, setHover] = useState<string | null>(null);
  const xs = useMemo(() => [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort(), [series]);
  const ys = series.flatMap((s) => s.points.map((p) => p.y));
  if (xs.length < 2 || !ys.length) return null;
  const ticks = niceTicks(yMin ?? Math.min(...ys), Math.max(...ys));
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  // time-proportional x positions
  const t0 = Date.parse(xs[0]);
  const t1 = Date.parse(xs[xs.length - 1]);
  const xPos = (x: string) => PAD.l + ((Date.parse(x) - t0) / Math.max(1, t1 - t0)) * (W - PAD.l - PAD.r);
  const yPos = (y: number) => PAD.t + (1 - (y - lo) / (hi - lo || 1)) * (H - PAD.t - PAD.b);
  const nearest = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    const vx = ((clientX - r.left) / r.width) * W;
    return xs.reduce((best, x) => (Math.abs(xPos(x) - vx) < Math.abs(xPos(best) - vx) ? x : best), xs[0]);
  };
  const hoverVals = hover ? series.map((s) => ({ s, p: s.points.find((p) => p.x === hover) })).filter((v) => v.p) : [];

  return (
    <figure className="relative">
      {series.length > 1 && <Legend items={series} />}
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={ariaLabel}
        aria-describedby={tableId}
        style={{ direction: "ltr" }}
        onPointerMove={(e) => setHover(nearest(e.clientX))}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={yPos(t)} y2={yPos(t)} stroke="var(--border)" strokeWidth="1" />
            <text x={PAD.l - 6} y={yPos(t) + 4} textAnchor="end" fontSize="11" fill="currentColor" className="text-stone-400">
              {format(t)}
            </text>
          </g>
        ))}
        {[xs[0], xs[xs.length - 1]].map((x, i) => (
          <text key={x + i} x={xPos(x)} y={H - 6} textAnchor={i ? "end" : "start"} fontSize="11" fill="currentColor" className="text-stone-400">
            {formatShortDate(x)}
          </text>
        ))}
        {series.map((s) => (
          <g key={s.label}>
            <polyline
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.dashed ? "5 4" : undefined}
              points={s.points
                .slice()
                .sort((a, b) => (a.x < b.x ? -1 : 1))
                .map((p) => `${xPos(p.x)},${yPos(p.y)}`)
                .join(" ")}
            />
            {s.points.length <= 24 &&
              s.points.map((p) => <circle key={p.x} cx={xPos(p.x)} cy={yPos(p.y)} r="4" fill={s.color} stroke="var(--surface)" strokeWidth="2" />)}
          </g>
        ))}
        {hover && <line x1={xPos(hover)} x2={xPos(hover)} y1={PAD.t} y2={H - PAD.b} stroke="currentColor" className="text-stone-300" strokeWidth="1" />}
      </svg>
      {hover && hoverVals.length > 0 && (
        <div
          className="surface pointer-events-none absolute top-6 z-10 rounded-lg border px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: `${(xPos(hover) / W) * 100}%`, transform: xPos(hover) > W / 2 ? "translateX(-105%)" : "translateX(5%)" }}
        >
          <div className="mb-0.5 font-medium">{formatShortDate(hover)}</div>
          {hoverVals.map(({ s, p }) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.label}: <span className="ltr-nums font-semibold">{format(p!.y)}</span>
            </div>
          ))}
        </div>
      )}
      <table id={tableId} className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th>תאריך</th>
            {series.map((s) => (
              <th key={s.label}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {xs.map((x) => (
            <tr key={x}>
              <td>{x}</td>
              {series.map((s) => (
                <td key={s.label}>{s.points.find((p) => p.x === x)?.y ?? ""}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Grouped bars per period: e.g. planned vs completed tasks per week. */
export function GroupedBars({ groups, keys, ariaLabel }: { groups: Array<{ label: string; values: number[] }>; keys: Array<{ label: string; color: string }>; ariaLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...groups.flatMap((g) => g.values));
  const ticks = niceTicks(0, max, 3);
  const top = ticks[ticks.length - 1];
  const innerW = W - PAD.l - PAD.r;
  const gw = innerW / groups.length;
  const bw = Math.min(22, (gw - 10) / keys.length - 2);
  const yPos = (v: number) => PAD.t + (1 - v / top) * (H - PAD.t - PAD.b);
  return (
    <figure className="relative">
      <Legend items={keys} />
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={ariaLabel} style={{ direction: "ltr" }} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={yPos(t)} y2={yPos(t)} stroke="var(--border)" />
            <text x={PAD.l - 6} y={yPos(t) + 4} textAnchor="end" fontSize="11" fill="currentColor" className="text-stone-400">
              {t}
            </text>
          </g>
        ))}
        {groups.map((g, gi) => {
          const cx = PAD.l + gw * gi + gw / 2;
          const total = keys.length * (bw + 2) - 2;
          return (
            <g key={g.label} onPointerEnter={() => setHover(gi)}>
              <rect x={PAD.l + gw * gi} y={PAD.t} width={gw} height={H - PAD.t - PAD.b} fill="transparent" />
              {g.values.map((v, ki) => {
                const x = cx - total / 2 + ki * (bw + 2);
                const y = yPos(v);
                const h = Math.max(0, H - PAD.b - y);
                return h > 0 ? (
                  <path key={ki} d={`M${x},${H - PAD.b} V${y + Math.min(4, h)} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${H - PAD.b} Z`} fill={keys[ki].color} />
                ) : null;
              })}
              <text x={cx} y={H - 6} textAnchor="middle" fontSize="11" fill="currentColor" className="text-stone-400">
                {g.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div
          className="surface pointer-events-none absolute top-6 z-10 rounded-lg border px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: `${((PAD.l + gw * hover + gw / 2) / W) * 100}%`, transform: "translateX(-50%)" }}
        >
          <div className="mb-0.5 font-medium">{groups[hover].label}</div>
          {keys.map((k, i) => (
            <div key={k.label} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: k.color }} />
              {k.label}: <b>{groups[hover].values[i]}</b>
            </div>
          ))}
        </div>
      )}
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <tbody>
          {groups.map((g) => (
            <tr key={g.label}>
              <th>{g.label}</th>
              {g.values.map((v, i) => (
                <td key={i}>
                  {keys[i].label}: {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
