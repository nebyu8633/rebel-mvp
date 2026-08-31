"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

const LINKS = [
  { href: "#how-it-works", label: "איך זה עובד" },
  { href: "#discover", label: "מה אפשר לגלות" },
  { href: "#how-we-calculate", label: "איך מחשבים" },
  { href: "#faq", label: "שאלות נפוצות" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${
        scrolled ? "bg-ink/80 backdrop-blur-md border-b border-cream/10" : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-10">
        <Link href="#top" className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-cream">
            רכש<span className="text-gold">.</span>אינטליגנציה
          </span>
        </Link>

        <div className="hidden items-center gap-9 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-cream/70 transition-colors hover:text-cream"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <Link
            href="/login"
            className="text-sm text-cream/70 transition-colors hover:text-cream"
          >
            כניסה
          </Link>
          <Link
            href="/upload"
            className="rounded-full bg-cream px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-gold"
          >
            בדיקת החיסכון שלי
          </Link>
        </div>

        <button
          aria-label="תפריט"
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 md:hidden"
        >
          <span
            className={`h-px w-6 bg-cream transition-transform ${open ? "translate-y-2 rotate-45" : ""}`}
          />
          <span className={`h-px w-6 bg-cream transition-opacity ${open ? "opacity-0" : ""}`} />
          <span
            className={`h-px w-6 bg-cream transition-transform ${open ? "-translate-y-2 -rotate-45" : ""}`}
          />
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="overflow-hidden border-t border-cream/10 bg-ink/95 backdrop-blur-md md:hidden"
          >
            <div className="flex flex-col gap-1 px-6 py-4">
              {LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="py-3 text-base text-cream/80"
                >
                  {l.label}
                </a>
              ))}
              <Link
                href="/upload"
                onClick={() => setOpen(false)}
                className="mt-3 rounded-full bg-cream px-5 py-3 text-center text-sm font-semibold text-ink"
              >
                בדיקת החיסכון שלי
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
