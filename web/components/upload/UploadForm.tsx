"use client";

import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { Dropzone } from "@/components/upload/Dropzone";
import { FileRow, type SelectedFile } from "@/components/upload/FileRow";
import { UploadCounter } from "@/components/upload/UploadCounter";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/analytics/track";
import { ensureAnonymousSession } from "@/lib/auth/actions";
import { getDictionary } from "@/lib/i18n";
import {
  MAX_FILES_PER_ANALYSIS,
  validateBatchSize,
  validateFile,
} from "@/lib/invoices/validateFile";

const dict = getDictionary();

/**
 * Turns a rejected upload into Hebrew the person can act on.
 *
 * The route handler re-runs the same validation the browser did and answers
 * with the same error keys, so a rejection that the client's own checks missed
 * still comes back as a specific reason rather than "the upload failed".
 */
async function describeFailure(response: Response): Promise<string> {
  if (response.status === 401) return dict.errors.unauthorized;

  try {
    const body = (await response.json()) as { error?: string };
    const key = body.error;
    if (key !== undefined && key in dict.validation) {
      return dict.validation[key as keyof typeof dict.validation];
    }
  } catch {
    // A non-JSON body (a proxy error page, a truncated response) tells us
    // nothing specific; fall through to the generic message.
  }

  return dict.analyze.uploadFailed;
}

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
  const batch = validateBatchSize(validFiles.length);
  const canSubmit = batch.ok && !isSubmitting;

  async function handleSubmit() {
    /*
     * The button stays enabled below the minimum and explains the shortfall
     * here instead. A greyed-out control gives no reason, and the reason is
     * the only thing that gets the person to five files.
     */
    if (!batch.ok) {
      setSubmitError(dict.validation[batch.errorKey ?? "tooFew"]);
      return;
    }
    if (isSubmitting) return;

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
        setSubmitError(await describeFailure(response));
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

      <UploadCounter count={validFiles.length} />

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-content-muted">{dict.analyze.whyFiveBody}</p>

        {/*
         * Disabled only while the request is in flight — never for having too
         * few files. Below the minimum the button still responds and names
         * what is missing; the counter above already says how many are left.
         */}
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={isSubmitting}
          aria-disabled={!canSubmit}
          className="sm:shrink-0"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {dict.analyze.uploading}
            </>
          ) : (
            <>
              {dict.analyze.startAnalysis}
              {/* The page is RTL, so "forward" points left. */}
              <ArrowLeft className="size-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
