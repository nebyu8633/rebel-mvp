"use client";

import { motion } from "framer-motion";

const STATES = [
  { label: "רמת ודאות גבוהה", value: 92, note: "מספיק חשבוניות להשוואה אמינה" },
  { label: "רמת ודאות בינונית", value: 58, note: "יש נתונים, אך מדגם מצומצם" },
  { label: "אין מספיק נתונים", value: 0, note: "לא מוצג פוטנציאל לחיסכון" },
];

export default function Trust() {
  return (
    <section className="bg-cream py-24 text-ink md:py-32">
      <div className="mx-auto max-w-5xl px-6 md:px-10">
        <div className="grid grid-cols-1 items-center gap-14 md:grid-cols-2">
          <div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-3xl font-bold leading-tight md:text-4xl"
            >
              אנחנו לא מנחשים.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="mt-6 max-w-md text-lg leading-relaxed text-ink/70"
            >
              כשאין מספיק נתונים להשוואה, אנחנו לא ממציאים מספר. כשאין ודאות מספקת, אנחנו מציגים
              זאת. כל הזדמנות לחיסכון צריכה להיות ניתנת להסבר.
            </motion.p>
          </div>

          <div className="space-y-5">
            {STATES.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.15 }}
              >
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-ink/80">{s.label}</span>
                  <span className="numeral text-ink/50">{s.value}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-ink/10">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${s.value}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, delay: 0.2 + i * 0.15, ease: [0.16, 1, 0.3, 1] }}
                    className={`h-full rounded-full ${s.value === 0 ? "bg-rust/40" : "bg-sage"}`}
                  />
                </div>
                <p className="mt-1.5 text-xs text-ink/45">{s.note}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
