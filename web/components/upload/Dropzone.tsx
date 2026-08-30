"use client";

import { Upload } from "lucide-react";
import { useCallback, useRef, useState, type DragEvent } from "react";

import { cn } from "@/lib/cn";
import { getDictionary } from "@/lib/i18n";
import { ACCEPT_ATTRIBUTE } from "@/lib/invoices/validateFile";

const dict = getDictionary();

/**
 * File intake.
 *
 * Drag and drop on pointer devices, and a plain file input everywhere — the
 * input carries `capture` hints so a phone offers the camera directly, which
 * is how most invoices will actually arrive (spec §50).
 */
export function Dropzone({
  onFilesSelected,
  disabled = false,
}: {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Drag events fire for every child element, so a plain boolean flickers as
  // the pointer moves across the zone. Counting enter/leave pairs is stable.
  const dragDepth = useRef(0);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (fileList === null || fileList.length === 0) return;
      onFilesSelected(Array.from(fileList));
    },
    [onFilesSelected],
  );

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    if (disabled) return;
    handleFiles(event.dataTransfer.files);
  };

  const onDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current += 1;
    if (!disabled) setIsDragging(true);
  };

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDragging(false);
    }
  };

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  return (
    <div
      onDrop={onDrop}
      onDragOver={(event) => event.preventDefault()}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      className={cn(
        "rounded-xl border-2 border-dashed p-8 text-center transition-colors sm:p-12",
        isDragging
          ? "border-accent bg-accent/5"
          : "border-border bg-surface/40 hover:border-border-strong",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        onChange={(event) => {
          handleFiles(event.target.files);
          // Reset so selecting the same file twice still fires a change event.
          event.target.value = "";
        }}
        className="sr-only"
        // Labelled by the visible button below rather than a hidden label, so
        // screen readers announce the same words sighted users read.
        aria-label={dict.analyze.dropzoneTitle}
      />

      <div className="flex flex-col items-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <Upload className="size-6" aria-hidden="true" />
        </span>

        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          className="mt-5 rounded-lg text-base font-semibold text-content transition-colors hover:text-accent"
        >
          {/* The desktop wording mentions dragging; the mobile one does not,
              because there is nothing to drag on a phone. */}
          <span className="hidden sm:inline">{dict.analyze.dropzoneTitle}</span>
          <span className="sm:hidden">{dict.analyze.dropzoneMobile}</span>
        </button>

        <p className="mt-2 text-sm text-content-muted">
          {/* Latin format names and the size cap stay LTR inside the RTL line. */}
          <span dir="ltr" style={{ unicodeBidi: "isolate" }}>
            {dict.analyze.dropzoneHint}
          </span>
        </p>
      </div>
    </div>
  );
}
