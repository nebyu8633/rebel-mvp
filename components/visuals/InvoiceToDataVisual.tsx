"use client";

import { motion } from "framer-motion";

const ROWS = [
  { name: "חזה עוף", qty: '8 ק"ג', price: "₪34.50", supplier: "מזון טרי בע\"מ" },
  { name: "עגבניות", qty: '15 ק"ג', price: "₪6.90", supplier: "ירקות השוק" },
];

export default function InvoiceToDataVisual() {
  return (
    <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[1fr_auto_1.4fr]">
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
        className="rounded-lg border border-cream/10 bg-ink/60 p-4"
      >
        <p className="mb-3 text-[11px] tracking-widest text-cream/35">חשבונית ספק · מסמך</p>
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-2.5 rounded-full bg-cream/10" style={{ width: `${90 - i * 10}%` }} />
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="hidden text-gold md:block"
      >
        <svg width="36" height="18" viewBox="0 0 36 18" fill="none">
          <path d="M34 9H2M2 9L9 2M2 9L9 16" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </motion.div>

      <div className="space-y-2">
        <div className="mb-2 flex justify-between text-[11px] tracking-widest text-cream/35">
          <span>מוצר</span>
          <span>כמות</span>
          <span>מחיר</span>
          <span>ספק</span>
        </div>
        {ROWS.map((r, i) => (
          <motion.div
            key={r.name}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.5 + i * 0.15 }}
            className="flex items-center justify-between rounded-lg border border-cream/10 bg-ink/40 px-4 py-3 text-sm"
          >
            <span className="text-cream/85">{r.name}</span>
            <span className="numeral text-cream/50">{r.qty}</span>
            <span className="numeral font-medium text-gold">{r.price}</span>
            <span className="text-xs text-cream/40">{r.supplier}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
