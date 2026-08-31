"use client";

import { motion } from "framer-motion";

const ROWS = [
  { label: "מחיר ששולם", value: '₪34.50 / ק"ג' },
  { label: "מחיר השוואה", value: '₪30.80 / ק"ג' },
  { label: "פער", value: '₪3.70 / ק"ג', highlight: true },
  { label: "כמות", value: '1,240 ק"ג' },
];

export default function SavingsVisual() {
  return (
    <div className="rounded-xl border border-gold/25 bg-ink/60 p-6">
      <div className="mb-6 flex items-center justify-between">
        <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] tracking-wide text-gold">
          נתוני הדגמה
        </span>
        <div className="text-left">
          <p className="text-[11px] tracking-widest text-cream/35">פוטנציאל לחיסכון</p>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="numeral text-3xl font-bold text-gold"
          >
            ₪12,840
          </motion.p>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between border-b border-cream/10 pb-3">
        <span className="font-medium text-cream/85">חזה עוף</span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {ROWS.map((r, i) => (
          <motion.div
            key={r.label}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.12 }}
          >
            <p className="text-[11px] text-cream/40">{r.label}</p>
            <p className={`numeral mt-1 text-base font-semibold ${r.highlight ? "text-rust" : "text-cream/85"}`}>
              {r.value}
            </p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="mt-5 border-t border-cream/10 pt-4 text-sm text-cream/50"
      >
        פוטנציאל למוצר זה:{" "}
        <span className="numeral font-semibold text-gold">₪4,588</span>
      </motion.div>
    </div>
  );
}
