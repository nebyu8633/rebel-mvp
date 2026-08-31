"use client";

import { motion } from "framer-motion";

const ITEMS = [
  "לא צריך להחליף POS",
  "לא צריך להחליף ספק",
  "לא צריך ERP חדש",
  "לא צריך להזין את כל הרכש ידנית",
  "לא צריך ללמוד מערכת מורכבת",
];

export default function NoNewSystem() {
  return (
    <section className="bg-cream py-24 text-ink md:py-32">
      <div className="mx-auto max-w-5xl px-6 md:px-10">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center text-3xl font-bold leading-tight md:text-4xl"
        >
          אתה לא צריך להתחיל לנהל עוד מערכת.
        </motion.h2>

        <div className="mx-auto mt-14 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          {ITEMS.map((it, i) => (
            <motion.div
              key={it}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white/50 px-5 py-4"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage/15 text-sage">
                ✓
              </span>
              <span className="text-sm font-medium text-ink/80">{it}</span>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mx-auto mt-14 max-w-lg text-center text-xl font-medium text-ink/80"
        >
          החשבוניות כבר אצלך. אנחנו עוזרים לך להבין אותן.
        </motion.p>
      </div>
    </section>
  );
}
