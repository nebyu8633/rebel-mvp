"use client";

import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { Dropzone } from "@/components/upload/Dropzone";
import { FileRow, type SelectedFile } from "@/components/upload/FileRow";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/analytics/track";
import { ensureAnonymousSession } from "@/lib/auth/actions";
import { getDictionary } from "@/lib/i18n";
import { MAX_FILES_PER_ANALYSIS, validateFile } from "@/lib/invoices/validateFile";

const dict = getDictionary();

/**
 * The upload screen's interactive half.
 *
 * Files are validated as they are selected so problems surface immediately,
 * then submitted together as one analysis. Invalid files stay listed with
 * their reason rather than disappearing — silently dropping a file the user
 * chose is worse than telling them why it will not work.
 */
export function UploadForm() {
  const router = useRouter();
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const addFiles = useCallback((incoming: File[]) => {
    setSubmitError(null);
    setFiles((current) => {
      const next = [...current];
      for (const file of incoming) {
        const result = validateFile(file, next.length);
        next.push({
          id: `${file.name}-${file.size}-${file.lastModified}-${next.length}`,
          file,
          status: result.ok ? "ready" : "error",
          ...(result.errorKey !== undefined ? { errorKey: result.errorKey } : {}),
        });
      }
      return next;
    });
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((current) => current.filter((item) => item.id !== id));
  }, []);

  const validFiles = files.filter((item) => item.status !== "error");
  const canSubmit = validFiles.length > 0 && !isSubmitting;

  async function handleSubmit() {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setSubmitError(null);
    track("upload_started", { fileCount: validFiles.length });

    try {
      // A session must exist before anything is stored, so the rows the
      // analysis creates have an owner and are covered by RLS from the start.
      const session = await ensureAnonymousSession();
      if (!session.ok) {
        setSubmitError(dict.errors.generic);
        return;
      }

      const formData = new FormData();
      for (const item of validFiles) formData.append("files", item.file);

      const response = await fetch("/api/analyses", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        setSubmitError(
          response.status === 401 ? dict.errors.unauthorized : dict.analyze.uploadFailed,
        );
        return;
      }

      const { analysisId } = (await response.json()) as { analysisId: string };
      track("upload_completed", { fileCount: validFiles.length });
      track("analysis_started", { analysisId });

      router.push(`/analysis/${analysisId}`);
    } catch {
      // Any throw here is a transport failure; the server reports its own
      // problems through the status code above.
      setSubmitError(dict.errors.network);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Dropzone
        onFilesSelected={addFiles}
        disabled={isSubmitting || files.length >= MAX_FILES_PER_ANALYSIS}
      />

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((item) => (
            <FileRow key={item.id} item={item} onRemove={removeFile} />
          ))}
        </ul>
      )}

      {submitError !== null && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {submitError}
        </p>
      )}

      {validFiles.length > 0 && (
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-content-muted">
            {validFiles.length} {dict.analyze.filesReady}
          </p>

          <Button size="lg" onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                {dict.analyze.uploading}
              </>
            ) : (
              <>
                {dict.analyze.startAnalysis}
                <ArrowLeft className="size-4" aria-hidden="true" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
