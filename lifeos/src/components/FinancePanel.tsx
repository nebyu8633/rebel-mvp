"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { FinanceEntry } from "@/lib/types";
import { useStore } from "@/lib/store/store";
import { addFinanceEntry } from "@/lib/actions";
import { formatILS, monthsLeft, scenarioTable, sortEntries, summarizeAccount } from "@/lib/finance";
import { formatHebDate } from "@/lib/dates";
import { useToday } from "@/hooks/useToday";
import { Badge, Button, Field, Input, Select, confirmDialog, cx } from "./ui";
import { LineChart } from "./charts";

const KIND_LABELS: Record<FinanceEntry["kind"], string> = { deposit: "הפקדה", withdrawal: "משיכה", valuation: "עדכון שווי/יתרה" };

export function FinanceSummary({ accountId, target }: { accountId: string; target: number | null }) {
  const db = useStore((s) => s.db);
  const acc = db.financeAccounts[accountId];
  const entries = Object.values(db.financeEntries).filter((e) => e.accountId === accountId);
  const s = summarizeAccount(entries);
  if (!acc) return null;
  const isPortfolio = acc.kind === "portfolio";
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label={isPortfolio ? "שווי נוכחי (מדווח)" : "יתרה נוכחית"} value={entries.length ? formatILS(s.currentValue) : "—"} strong />
      <Stat label="יעד" value={target ? formatILS(target) : "לא הוגדר"} />
      <Stat label="נותר" value={target && entries.length ? formatILS(Math.max(0, target - s.currentValue)) : "—"} />
      {isPortfolio ? (
        <Stat
          label="שינוי שוק (מעבר להפקדות)"
          value={entries.length ? formatILS(s.marketChange) : "—"}
          tone={s.marketChange > 0 ? "pos" : s.marketChange < 0 ? "neg" : undefined}
        />
      ) : (
        <Stat label="הפקדות נטו" value={entries.length ? formatILS(s.netContributions) : "—"} />
      )}
    </div>
  );
}

function Stat({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "pos" | "neg" }) {
  return (
    <div className="rounded-xl bg-stone-50 p-3 dark:bg-white/[0.03]">
      <div className="text-xs text-stone-500">{label}</div>
      <div className={cx("ltr-nums mt-0.5 text-start", strong ? "text-lg font-bold" : "font-semibold", tone === "pos" && "text-accent-700", tone === "neg" && "text-rose-600")}>{value}</div>
    </div>
  );
}

export function FinanceEntries({ accountId, portfolio }: { accountId: string; portfolio?: boolean }) {
  const db = useStore((s) => s.db);
  const remove = useStore((s) => s.remove);
  const today = useToday();
  const [kind, setKind] = useState<FinanceEntry["kind"]>(portfolio ? "valuation" : "deposit");
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const entries = sortEntries(Object.values(db.financeEntries).filter((e) => e.accountId === accountId)).reverse();
  const summary = summarizeAccount(Object.values(db.financeEntries).filter((e) => e.accountId === accountId));

  async function add() {
    const n = Number(amount.replace(/[,₪\s]/g, ""));
    if (!amount || Number.isNaN(n) || n < 0) return setErr("יש להזין סכום חיובי");
    if (date > today) return setErr("לא ניתן לרשום עדכון עתידי");
    setErr(null);
    if (await addFinanceEntry({ accountId, date, kind, amount: n, note: note.trim() })) {
      setAmount("");
      setNote("");
    }
  }

  return (
    <div className="space-y-4">
      {summary.history.length >= 2 && (
        <LineChart
          ariaLabel="היסטוריית שווי"
          series={[
            { label: portfolio ? "שווי" : "יתרה", color: "var(--series-1)", points: summary.history.map((h) => ({ x: h.date, y: h.value })) },
            ...(portfolio ? [{ label: "סכום שהופקד", color: "var(--series-2)", dashed: true, points: summary.history.map((h) => ({ x: h.date, y: h.contributed })) }] : []),
          ]}
          format={(v) => formatILS(v)}
        />
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1.2fr_1fr_1fr_1.5fr_auto] sm:items-end">
        <Field label="סוג">
          <Select value={kind} onChange={(e) => setKind(e.target.value as FinanceEntry["kind"])}>
            {Object.entries(KIND_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="תאריך">
          <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="סכום (₪)" error={err}>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </Field>
        <Field label="הערה">
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        </Field>
        <Button variant="primary" onClick={add} className="col-span-2 sm:col-span-1">
          רישום
        </Button>
      </div>
      <p className="text-xs text-stone-500">
        {portfolio
          ? "״עדכון שווי״ = השווי הכולל של התיק לפי הדיווח שלך. הפקדות נרשמות בנפרד, כך שאפשר להבחין בין כסף שהוכנס לבין שינויי שוק."
          : "״עדכון יתרה״ מתקן את היתרה לסכום המדויק; הפקדות ומשיכות מעדכנות אותה."}
      </p>
      {entries.length > 0 && (
        <ul className="divide-y hairline text-sm">
          {entries.slice(0, 30).map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-2">
              <span className="w-20 shrink-0 text-xs text-stone-500">{formatHebDate(e.date)}</span>
              <Badge tone={e.kind === "deposit" ? "accent" : e.kind === "withdrawal" ? "rose" : "indigo"}>{KIND_LABELS[e.kind]}</Badge>
              <span className="ltr-nums font-medium">{formatILS(e.amount)}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-stone-500">{e.note}</span>
              <Button
                size="icon"
                variant="ghost"
                aria-label="מחיקת רישום"
                onClick={async () => {
                  if (await confirmDialog({ title: "למחוק את הרישום?", message: `${KIND_LABELS[e.kind]} של ${formatILS(e.amount)} מ-${formatHebDate(e.date)}`, danger: true, confirmLabel: "מחיקה" }))
                    await remove("financeEntries", e.id);
                }}
              >
                <Trash2 size={14} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PortfolioScenarios({ accountId, target, deadline }: { accountId: string; target: number; deadline: string }) {
  const db = useStore((s) => s.db);
  const today = useToday();
  const entries = Object.values(db.financeEntries).filter((e) => e.accountId === accountId);
  if (!entries.length)
    return <p className="text-sm text-stone-500">רשמו את שווי התיק הנוכחי כדי לחשב כמה צריך להפקיד בחודש.</p>;
  const s = summarizeAccount(entries);
  const months = monthsLeft(today, deadline);
  const rows = scenarioTable(s.currentValue, target, months);
  return (
    <div>
      <p className="mb-2 text-sm text-stone-600 dark:text-stone-300">
        הפקדה חודשית נדרשת כדי להגיע ל-{formatILS(target)} בעוד {months} חודשים, לפי הנחות תשואה שונות:
      </p>
      <div className="overflow-hidden rounded-xl border hairline">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-xs text-stone-500 dark:bg-white/[0.03]">
            <tr>
              <th className="px-3 py-2 text-start font-medium">תרחיש (הנחה)</th>
              <th className="px-3 py-2 text-start font-medium">תשואה שנתית מונחת</th>
              <th className="px-3 py-2 text-start font-medium">הפקדה חודשית</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t hairline">
                <td className="px-3 py-2">{r.label}</td>
                <td className="ltr-nums px-3 py-2 text-start">{(r.annualRate * 100).toFixed(0)}%</td>
                <td className="ltr-nums px-3 py-2 text-start font-semibold">{formatILS(r.monthly)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-stone-500">
        המחשה בלבד, לא ייעוץ השקעות ולא תחזית. התשואה בפועל עלולה להיות נמוכה יותר ואף שלילית; שווי התיק עשוי לרדת. החישוב מניח תשואה קבועה והפקדה בסוף כל חודש.
      </p>
    </div>
  );
}
