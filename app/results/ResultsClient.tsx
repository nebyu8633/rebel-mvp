"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

type StoredInvoices = { count: number; names: string[] };

const DEMO_ROWS = [
  {
    product: "חזה עוף",
    paid: '₪34.50 / ק"ג',
    compare: '₪30.80 / ק"ג',
    gap: '₪3.70 / ק"ג',
    qty: '1,240 ק"ג',
    potential: "₪4,588",
  },
  {
    product: "שמן קנולה",
    paid: "₪9.20 / ל'",
    compare: "₪8.10 / ל'",
    gap: "₪1.10 / ל'",
    qty: "1,800 ל'",
    potential: "₪1,980",
  },
  {
    product: "קמח לבן",
    paid: '₪4.10 / ק"ג',
    compare: '₪3.65 / ק"ג',
    gap: '₪0.45 / ק"ג',
    qty: '2,900 ק"ג',
    potential: "₪1,305",
  },
];

export default function ResultsClient() {
  const [invoices, setInvoices] = useState<StoredInvoices | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("rpi-invoices");
      if (raw) setInvoices(JSON.parse(raw));
    } catch {
      setInvoices(null);
    }
  }, []);

  return (
    <main dir="rtl" className="min-h-screen bg-ink text-cream">
      <div className="mx-auto max-w-4xl px-6 py-16 md:px-10 md:py-24">
        <Link href="/" className="text-sm text-cream/50 transition-colors hover:text-cream">
          → חזרה לדף הבית
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mt-6"
        >
          {invoices && invoices.count > 0 ? (
            <>
              <h1 className="text-3xl font-bold leading-tight md:text-4xl">
                {invoices.count} חשבוניות התקבלו בהצלחה
              </h1>
              <p className="mt-3 max-w-xl text-cream/60">
                עיבוד הנתונים המלא של החשבוניות שהעלית עדיין לא זמין בגרסת ההדגמה הזו. כך תיראה
                תוצאת הניתוח כאשר יש מספיק נתונים אמיתיים להשוואה.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold leading-tight md:text-4xl">עדיין אין נתונים לניתוח</h1>
              <p className="mt-3 max-w-xl text-cream/60">
                לא נמצאו חשבוניות שהועלו בסשן הנוכחי. יש להעלות לפחות 5 חשבוניות ספקים כדי להתחיל
                ניתוח.
              </p>
              <Link
                href="/upload"
                className="mt-6 inline-block rounded-full bg-cream px-7 py-3.5 text-base font-semibold text-ink transition-transform hover:scale-[1.03] hover:bg-gold"
              >
                העלאת חשבוניות
              </Link>
            </>
          )}
        </motion.div>

        {invoices && invoices.count > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mt-12 rounded-2xl border border-gold/25 bg-charcoal/50 p-6 md:p-8"
          >
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] tracking-wide text-gold">
                נתוני הדגמה בלבד
              </span>
              <div className="text-left">
                <p className="text-[11px] tracking-widest text-cream/35">פוטנציאל לחיסכון לדוגמה</p>
                <p className="numeral text-3xl font-bold text-gold">₪7,873</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-right text-sm">
                <thead>
                  <tr className="border-b border-cream/10 text-cream/40">
                    <th className="pb-3 font-normal">מוצר</th>
                    <th className="pb-3 font-normal">מחיר ששולם</th>
                    <th className="pb-3 font-normal">מחיר השוואה</th>
                    <th className="pb-3 font-normal">פער</th>
                    <th className="pb-3 font-normal">כמות</th>
                    <th className="pb-3 font-normal">פוטנציאל</th>
                  </tr>
                </thead>
                <tbody>
                  {DEMO_ROWS.map((r) => (
                    <tr key={r.product} className="border-b border-cream/5">
                      <td className="py-3 font-medium text-cream/85">{r.product}</td>
                      <td className="numeral py-3 text-cream/60">{r.paid}</td>
                      <td className="numeral py-3 text-cream/60">{r.compare}</td>
                      <td className="numeral py-3 text-rust">{r.gap}</td>
                      <td className="numeral py-3 text-cream/60">{r.qty}</td>
                      <td className="numeral py-3 font-semibold text-gold">{r.potential}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-6 text-xs leading-relaxed text-cream/35">
              המספרים שלמעלה הם נתוני הדגמה בלבד ואינם מבוססים על החשבוניות שהעלית. פוטנציאל
              לחיסכון אמיתי מוצג רק כאשר קיימים מספיק נתונים להשוואה, ואינו מהווה הבטחה לחיסכון
              בפועל.
            </p>
          </motion.div>
        )}
      </div>
    </main>
  );
}
