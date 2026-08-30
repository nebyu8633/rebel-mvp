"use client";

import { AlertCircle, Check, FileText, Loader2, X } from "lucide-react";

import { Ltr } from "@/components/ui/Ltr";
import { cn } from "@/lib/cn";
import { getDictionary } from "@/lib/i18n";
import { formatFileSize, type FileValidationError } from "@/lib/invoices/validateFile";

const dict = getDictionary();

export type UploadStatus = "ready" | "uploading" | "uploaded" | "error";

export interface SelectedFile {
  id: string;
  file: File;
  status: UploadStatus;
  errorKey?: FileValidationError | "uploadFailed";
}

function errorMessage(key: SelectedFile["errorKey"]): string {
  if (key === undefined) return dict.errors.generic;
  if (key === "uploadFailed") return dict.analyze.uploadFailed;
  return dict.validation[key];
}

export function FileRow({
  item,
  onRemove,
}: {
  item: SelectedFile;
  onRemove: (id: string) => void;
}) {
  const isError = item.status === "error";

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-surface px-4 py-3",
        isError ? "border-danger/40" : "border-border",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          isError ? "bg-danger/10 text-danger" : "bg-surface-2 text-content-muted",
        )}
      >
        {item.status === "uploading" ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : isError ? (
          <AlertCircle className="size-4" aria-hidden="true" />
        ) : (
          <FileText className="size-4" aria-hidden="true" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        {/* Filenames are usually Latin and must not reverse inside RTL text. */}
        <p className="truncate text-sm font-medium text-content">
          <Ltr>{item.file.name}</Ltr>
        </p>
        <p className={cn("mt-0.5 text-xs", isError ? "text-danger" : "text-content-subtle")}>
          {isError ? (
            errorMessage(item.errorKey)
          ) : (
            <Ltr>{formatFileSize(item.file.size)}</Ltr>
          )}
        </p>
      </div>

      {item.status === "uploaded" && (
        <Check className="size-4 shrink-0 text-accent" aria-hidden="true" />
      )}

      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="shrink-0 rounded-md p-1.5 text-content-subtle transition-colors hover:bg-surface-2 hover:text-content"
        aria-label={`${dict.analyze.removeFile}: ${item.file.name}`}
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </li>
  );
}
