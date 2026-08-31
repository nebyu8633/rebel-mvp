"use client";

import { motion } from "framer-motion";

const EXAMPLES = [
  { qty: '10 ק"ג', price: "₪100", unit: '₪10 / ק"ג', name: "קמח" },
  { qty: "20 ל'", price: "₪184", unit: "₪9.20 / ל'", name: "שמן" },
];

export default function NormalizeVisual() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {EXAMPLES.map((ex, i) => (
        <motion.div
          key={ex.name}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: i * 0.15 }}
          className="rounded-lg border border-cream/10 bg-ink/50 p-5"
        >
          <p className="mb-4 text-sm text-cream/60">{ex.name}</p>
          <div className="flex items-center justify-center gap-3 text-center">
            <div className="rounded-md bg-cream/5 px-3 py-2">
              <p className="numeral text-lg font-medium text-cream/80">{ex.qty}</p>
            </div>
            <span className="text-cream/30">+</span>
            <div className="rounded-md bg-cream/5 px-3 py-2">
              <p className="numeral text-lg font-medium text-cream/80">{ex.price}</p>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, height: 0 }}
            whileInView={{ opacity: 1, height: "auto" }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 + i * 0.15 }}
            className="mt-4 flex flex-col items-center gap-2"
          >
            <span className="text-gold">↓</span>
            <div className="rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5">
              <p className="numeral text-base font-bold text-gold">{ex.unit}</p>
            </div>
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
}
