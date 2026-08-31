"use client";

import { motion } from "framer-motion";

const CHAIN = ["חשבונית", "נתונים", "מוצר", "מחיר", "השוואה", "פוטנציאל"];

const ROWS = [
  { name: "חזה עוף", qty: '12 ק"ג', price: "₪34.50" },
  { name: "שמן קנולה", qty: "20 ל'", price: "₪9.20" },
  { name: "קמח לבן", qty: '25 ק"ג', price: "₪4.10" },
];

export default function HeroVisual() {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      {/* base texture */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 75% 20%, rgba(185,138,74,0.16), transparent 60%), radial-gradient(ellipse 70% 50% at 20% 80%, rgba(92,107,82,0.14), transparent 55%), #0b0a08",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, #fff 2px, #fff 3px)",
        }}
      />

      {/* floating invoice card */}
      <motion.div
        initial={{ opacity: 0, y: 40, rotate: -3 }}
        animate={{ opacity: 1, y: 0, rotate: -3 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
        className="absolute left-[8%] top-[16%] hidden w-[280px] rounded-xl border border-cream/15 bg-charcoal/70 p-5 shadow-2xl backdrop-blur-sm md:block"
      >
        <div className="mb-4 flex items-center justify-between border-b border-cream/10 pb-3">
          <span className="text-xs tracking-widest text-cream/40">חשבונית ספק</span>
          <span className="numeral text-xs text-cream/40">#2847</span>
        </div>
        <div className="space-y-3">
          {ROWS.map((r, i) => (
            <motion.div
              key={r.name}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1 + i * 0.22, duration: 0.6 }}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-cream/80">{r.name}</span>
              <span className="numeral text-cream/50">{r.qty}</span>
              <span className="numeral font-medium text-gold">{r.price}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* savings potential chip */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 1.6 }}
        className="absolute left-[10%] top-[54%] hidden rounded-xl border border-gold/30 bg-ink/80 px-5 py-4 shadow-2xl backdrop-blur-sm md:block"
      >
        <p className="mb-1 text-[11px] tracking-widest text-cream/40">פוטנציאל לחיסכון · נתוני הדגמה</p>
        <p className="numeral text-2xl font-bold text-gold">₪12,840</p>
      </motion.div>

      {/* process chain, right side */}
      <div className="absolute right-[6%] top-[14%] hidden w-64 flex-col items-end gap-5 md:flex">
        {CHAIN.map((step, i) => (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + i * 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-3"
          >
            <span className="text-sm text-cream/60">{step}</span>
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                i === CHAIN.length - 1 ? "bg-gold" : "bg-cream/25"
              }`}
            />
            {i < CHAIN.length - 1 && (
              <motion.span
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.8 + i * 0.15, duration: 0.5 }}
                className="h-5 w-px origin-top bg-cream/15"
              />
            )}
          </motion.div>
        ))}
      </div>

      {/* mobile-only simplified accent */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.6 }}
        className="absolute left-1/2 top-[18%] -translate-x-1/2 md:hidden"
      >
        <div className="rounded-xl border border-cream/15 bg-charcoal/70 px-5 py-3 backdrop-blur-sm">
          <p className="text-[11px] tracking-widest text-cream/40">פוטנציאל לחיסכון</p>
          <p className="numeral text-xl font-bold text-gold">₪12,840</p>
        </div>
      </motion.div>
    </div>
  );
}
