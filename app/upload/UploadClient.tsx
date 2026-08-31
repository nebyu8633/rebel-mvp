"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";

const MIN_INVOICES = 5;
const ACCEPTED = [".pdf", ".png", ".jpg", ".jpeg", "application/pdf", "image/png", "image/jpeg"];

type UploadedFile = { name: string; size: number };

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadClient() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const addFiles = useCallback((list: FileList | null) => {
    if (!list) return;
    const next: UploadedFile[] = Array.from(list).map((f) => ({ name: f.name, size: f.size }));
    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const merged = [...prev, ...next.filter((f) => !existingNames.has(f.name))];
      return merged.slice(0, 25);
    });
  }, []);

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const canAnalyze = files.length >= MIN_INVOICES;
  const remaining = Math.max(0, MIN_INVOICES - files.length);

  const handleSubmit = async () => {
    if (!canAnalyze || submitting) return;
    setSubmitting(true);
    try {
      sessionStorage.setItem(
        "rpi-invoices",
        JSON.stringify({ count: files.length, names: files.map((f) => f.name) })
      );
    } catch {
      // sessionStorage may be unavailable; analysis can still proceed
    }
    await new Promise((r) => setTimeout(r, 900));
    router.push("/results");
  };

  return (
    <main dir="rtl" className="min-h-screen bg-ink text-cream">
      <div className="mx-auto max-w-3xl px-6 py-16 md:px-10 md:py-24">
        <Link href="/" className="text-sm text-cream/50 transition-colors hover:text-cream">
          → חזרה לדף הבית
        </Link>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mt-6 text-3xl font-bold leading-tight md:text-4xl"
        >
          העלה לפחות 5 חשבוניות ספקים
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mt-3 max-w-xl text-cream/60"
        >
          זה כל מה שצריך כדי להתחיל את הבדיקה. ניתן להעלות קבצי PDF או תמונות.
        </motion.p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          className={`mt-8 cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
            dragOver ? "border-gold bg-gold/5" : "border-cream/20 hover:border-cream/40"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <p className="text-lg font-medium text-cream/85">גרור לכאן חשבוניות או לחץ לבחירה</p>
          <p className="mt-2 text-sm text-cream/40">PDF, PNG, JPG</p>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <span className="text-sm text-cream/50">
            {files.length} / {MIN_INVOICES} חשבוניות
          </span>
          {remaining > 0 ? (
            <span className="text-sm text-gold">עוד {remaining} כדי להתחיל ניתוח</span>
          ) : (
            <span className="text-sm text-sage">מספיק חשבוניות לניתוח</span>
          )}
        </div>

        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-cream/10">
          <motion.div
            animate={{ width: `${Math.min(100, (files.length / MIN_INVOICES) * 100)}%` }}
            transition={{ duration: 0.4 }}
            className={`h-full rounded-full ${canAnalyze ? "bg-sage" : "bg-gold"}`}
          />
        </div>

        <div className="mt-6 space-y-2">
          <AnimatePresence>
            {files.map((f) => (
              <motion.div
                key={f.name}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-between rounded-lg border border-cream/10 bg-charcoal/50 px-4 py-3"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="shrink-0 text-gold">📄</span>
                  <span className="truncate text-sm text-cream/80">{f.name}</span>
                  <span className="numeral shrink-0 text-xs text-cream/35">{formatSize(f.size)}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(f.name);
                  }}
                  aria-label={`הסר ${f.name}`}
                  className="shrink-0 text-cream/40 transition-colors hover:text-rust"
                >
                  ✕
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <motion.button
          onClick={handleSubmit}
          disabled={!canAnalyze || submitting}
          whileHover={canAnalyze ? { scale: 1.02 } : {}}
          className={`mt-10 w-full rounded-full px-8 py-4 text-base font-semibold transition-colors ${
            canAnalyze
              ? "bg-cream text-ink hover:bg-gold"
              : "cursor-not-allowed bg-cream/10 text-cream/30"
          }`}
        >
          {submitting ? "מנתח את הנתונים…" : "התחל ניתוח"}
        </motion.button>

        <p className="mt-4 text-center text-xs text-cream/35">
          המערכת דורשת מינימום 5 חשבוניות ספקים כדי לבצע השוואת מחירים אמינה.
        </p>
      </div>
    </main>
  );
}
