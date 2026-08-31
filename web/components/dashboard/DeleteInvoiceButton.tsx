"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { track } from "@/lib/analytics/track";
import { getDictionary } from "@/lib/i18n";

const dict = getDictionary();

/**
 * Deletes an invoice behind a confirmation dialog.
 *
 * Confirmation is required because the deletion is irreversible and also
 * removes the invoice's prices from the history, changing past comparisons —
 * the dialog says so rather than asking a bare "are you sure?".
 */
export function DeleteInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus the safe choice, not the destructive one.
    cancelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  async function handleDelete() {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, { method: "DELETE" });

      if (!response.ok) {
        setError(
          response.status === 401 ? dict.errors.unauthorized : dict.errors.generic,
        );
        return;
      }

      track("invoice_deleted", { invoiceId });
      setIsOpen(false);
      router.push("/dashboard/invoices");
      router.refresh();
    } catch {
      setError(dict.errors.network);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <Button variant="danger" onClick={() => setIsOpen(true)}>
        <Trash2 className="size-4" aria-hidden="true" />
        {dict.common.delete}
      </Button>

      {isOpen && (
        <div
          // Same as the product detail panel: a native <dialog> is only modal
          // when opened with showModal(), and this one renders conditionally.
          // oxlint-disable-next-line prefer-tag-over-role
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-invoice-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6">
            <h2 id="delete-invoice-title" className="text-lg font-semibold">
              {dict.invoices.deleteTitle}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-content-muted">
              {dict.invoices.deleteBody}
            </p>

            {error !== null && (
              <p role="alert" className="mt-4 text-sm text-danger">
                {error}
              </p>
            )}

            <div className="mt-6 flex gap-3">
              <Button
                ref={cancelRef}
                variant="secondary"
                onClick={() => setIsOpen(false)}
                disabled={isDeleting}
                className="flex-1"
              >
                {dict.common.cancel}
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1"
              >
                {isDeleting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  dict.invoices.deleteConfirm
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
