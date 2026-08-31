"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";

export default function RoiCalculator() {
  const [gap, setGap] = useState(2.5);
  const [qty, setQty] = useState(800);

  const potential = useMemo(() => Math.round(gap * qty), [gap, qty]);

  return (
    <section className="bg-ink py-24 md:py-32">
      <div className="mx-auto max-w-4xl px-6 text-center md:px-10">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-3xl font-bold leading-tight text-cream md:text-4xl"
        >
          פער קטן במחיר. השפעה גדולה לאורך זמן.
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="mx-auto mt-14 max-w-2xl rounded-2xl border border-cream/10 bg-charcoal/50 p-6 md:p-10"
        >
          <div className="mb-8 flex flex-wrap items-center justify-center gap-3 text-2xl font-bold text-cream md:text-3xl">
            <span className="numeral text-gold">₪{gap.toFixed(2)} / ק&quot;ג</span>
            <span className="text-cream/30">×</span>
            <span className="numeral">{qty.toLocaleString("he-IL")} ק&quot;ג</span>
            <span className="text-cream/30">=</span>
            <motion.span
              key={potential}
              initial={{ opacity: 0.4, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              className="numeral text-rust"
            >
              ₪{potential.toLocaleString("he-IL")}
            </motion.span>
          </div>

          <div className="space-y-6 text-right">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm text-cream/50">
                <span className="numeral">₪{gap.toFixed(2)}</span>
                <span>פער במחיר לק&quot;ג</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={10}
                step={0.1}
                value={gap}
                onChange={(e) => setGap(Number(e.target.value))}
                className="w-full accent-gold"
                aria-label="פער במחיר לק״ג"
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-sm text-cream/50">
                <span className="numeral">{qty.toLocaleString("he-IL")} ק&quot;ג</span>
                <span>כמות רכישה חודשית</span>
              </div>
              <input
                type="range"
                min={50}
                max={5000}
                step={50}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                className="w-full accent-gold"
                aria-label="כמות רכישה חודשית"
              />
            </div>
          </div>

          <p className="mt-2 pt-6 text-xs text-cream/35">
            הדגמת נוסחה בלבד. התוצאה בפועל תלויה בנתונים האמיתיים מהחשבוניות שתעלה.
          </p>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mx-auto mt-10 max-w-lg text-base leading-relaxed text-cream/55"
        >
          ככל שנפח הרכישה גדול יותר, גם פער קטן במחיר יכול להפוך למשמעותי.
        </motion.p>
      </div>
    </section>
  );
}
