import { NextResponse } from "next/server";

import { runAnalysis, type PipelineFile } from "@/lib/invoices/pipeline";
import {
  MAX_FILES_PER_ANALYSIS,
  MAX_FILE_SIZE_BYTES,
  sniffMimeType,
  validateFile,
} from "@/lib/invoices/validateFile";
import { ensureBusiness } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Reading and extracting several documents takes well over the default. */
export const maxDuration = 300;

/**
 * Creates an analysis from an upload.
 *
 * Validates and stores nothing until the caller is known, then returns as soon
 * as the analysis row exists — the pipeline itself runs after the response so
 * the browser is not held open for the length of the extraction. The client
 * polls `/api/analyses/[id]` for progress.
 */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user === null) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const business = await ensureBusiness(supabase);
  if (business === null) {
    return NextResponse.json({ error: "no_business" }, { status: 400 });
  }

  const formData = await request.formData();
  const uploads = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

  if (uploads.length === 0) {
    return NextResponse.json({ error: "no_files" }, { status: 400 });
  }
  if (uploads.length > MAX_FILES_PER_ANALYSIS) {
    return NextResponse.json({ error: "too_many_files" }, { status: 400 });
  }

  const files: PipelineFile[] = [];
  for (const [index, upload] of uploads.entries()) {
    // Re-validate server-side. The client checks are for fast feedback only;
    // this request can be made directly.
    const check = validateFile(
      { name: upload.name, size: upload.size, type: upload.type },
      index,
    );
    if (!check.ok) {
      return NextResponse.json({ error: check.errorKey }, { status: 400 });
    }

    const bytes = new Uint8Array(await upload.arrayBuffer());
    if (bytes.byteLength > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "tooLarge" }, { status: 400 });
    }

    // Trust the file's own bytes over its declared type: a renamed binary
    // reports whatever MIME type the browser infers from its extension.
    const actualType = sniffMimeType(bytes);
    if (actualType === null) {
      return NextResponse.json({ error: "wrongType" }, { status: 400 });
    }

    files.push({ fileName: upload.name, mimeType: actualType, bytes });
  }

  const admin = getSupabaseAdminClient();
  const analysisId = crypto.randomUUID();

  const { error } = await admin.from("analyses").insert({
    id: analysisId,
    business_id: business.id,
    status: "pending",
    steps: {},
  });

  if (error !== null) {
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }

  // Deliberately not awaited: the analysis runs past this response and the
  // client polls for its state. A rejection is already handled inside
  // runAnalysis, which records the failure on the row.
  void runAnalysis(admin, business.id, analysisId, files);

  return NextResponse.json({ analysisId }, { status: 201 });
}
