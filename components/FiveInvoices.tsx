"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const INVOICES = [1, 2, 3, 4, 5];

export default function FiveInvoices() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-charcoal to-ink py-24 md:py-32">
      <div className="mx-auto max-w-4xl px-6 text-center md:px-10">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-3xl font-bold leading-tight text-cream md:text-4xl"
        >
          יש לך 5 חשבוניות?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mt-4 text-lg text-cream/60"
        >
          זה כל מה שצריך כדי להתחיל את הבדיקה.
        </motion.p>

        <div className="relative mx-auto mt-16 flex h-40 max-w-xl items-center justify-center">
          {INVOICES.map((n, i) => (
            <motion.div
              key={n}
              initial={{ opacity: 0, y: 50, rotate: (i - 2) * 6 }}
              whileInView={{ opacity: 1, y: 0, rotate: (i - 2) * 6 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              style={{ zIndex: i, marginInlineStart: i === 0 ? 0 : -36 }}
              className="flex h-32 w-24 flex-col items-center justify-center rounded-lg border border-cream/15 bg-charcoal shadow-xl md:h-36 md:w-28"
            >
              <span className="text-[10px] tracking-widest text-cream/35">חשבונית</span>
              <span className="numeral mt-1 text-xl font-bold text-cream/80">
                {String(n).padStart(2, "0")}
              </span>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="mt-10 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-5 py-2 text-sm font-medium text-gold"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          ניתוח מוכן
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 1.05 }}
          className="mt-8"
        >
          <Link
            href="/upload"
            className="inline-block rounded-full bg-cream px-8 py-4 text-base font-semibold text-ink transition-transform hover:scale-[1.03] hover:bg-gold"
          >
            בדיקת החיסכון שלי
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
