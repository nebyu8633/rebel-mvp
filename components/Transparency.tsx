"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const FIELDS = [
  { label: "מחיר בחשבונית", value: "₪34.50" },
  { label: "כמות", value: '8 ק"ג' },
  { label: "גודל אריזה", value: '1 ק"ג' },
  { label: "יחידת מידה", value: 'ק"ג' },
  { label: "מחיר מנורמל", value: '₪34.50 / ק"ג' },
  { label: "מחיר השוואה", value: '₪30.80 / ק"ג' },
  { label: "תקופת תצפית", value: "90 יום אחרונים" },
  { label: "מקור ההשוואה", value: "חשבוניות דומות במאגר" },
  { label: "רמת ודאות", value: "גבוהה" },
];

export default function Transparency() {
  const [open, setOpen] = useState(false);

  return (
    <section id="how-we-calculate" className="bg-ink py-24 md:py-32">
      <div className="mx-auto max-w-4xl px-6 text-center md:px-10">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-3xl font-bold leading-tight text-cream md:text-4xl"
        >
          לא רק המספר. גם הדרך שבה הגענו אליו.
        </motion.h2>

        <motion.button
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.15 }}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-9 inline-flex items-center gap-2 rounded-full border border-cream/25 px-6 py-3 text-sm font-medium text-cream/85 transition-colors hover:border-gold hover:text-gold"
        >
          איך חישבנו את זה?
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.3 }}>
            ↓
          </motion.span>
        </motion.button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-8 grid grid-cols-1 gap-3 rounded-2xl border border-cream/10 bg-charcoal/50 p-6 text-right sm:grid-cols-2 md:p-8">
                {FIELDS.map((f, i) => (
                  <motion.div
                    key={f.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                    className="flex items-center justify-between border-b border-cream/5 py-2.5"
                  >
                    <span className="text-sm text-cream/50">{f.label}</span>
                    <span className="numeral text-sm font-medium text-cream/90">{f.value}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mx-auto mt-10 max-w-lg text-base leading-relaxed text-cream/50"
        >
          אנחנו לא ממציאים נתונים. כשאין מספיק מידע להשוואה — אנחנו אומרים את זה:{" "}
          <span className="text-cream/80">״אין מספיק נתונים להשוואה.״</span>
        </motion.p>
      </div>
    </section>
  );
}
