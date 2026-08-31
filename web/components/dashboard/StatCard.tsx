import { formatNumber } from "@/lib/format/currency";

export function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-4">
      <p className="text-xs text-content-muted">{label}</p>
      <p
        dir="ltr"
        style={{ unicodeBidi: "isolate" }}
        className="tnum mt-2 text-2xl font-semibold text-content"
      >
        {formatNumber(value)}
      </p>
    </div>
  );
}
