/**
 * The batch-size rule as the route handler actually enforces it.
 *
 * This matters more than the unit test on `validateBatchSize`: the upload
 * screen's counter can be bypassed by posting to this endpoint directly, so
 * the guarantee is only as good as what this handler does. Everything the
 * handler depends on — Supabase, the analysis pipeline — is stubbed, because
 * the question here is which requests get past validation, not what happens to
 * the ones that do.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_FILES_PER_ANALYSIS, MIN_FILES_PER_ANALYSIS } from "@/lib/invoices/validateFile";

const runAnalysis = vi.fn();
const insert = vi.fn(() => Promise.resolve({ error: null }));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () =>
    Promise.resolve({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "user-1" } } }) },
    }),
}));

vi.mock("@/lib/auth/session", () => ({
  ensureBusiness: () => Promise.resolve({ id: "business-1" }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({ from: () => ({ insert }) }),
}));

vi.mock("@/lib/invoices/pipeline", () => ({
  runAnalysis: (...args: unknown[]) => runAnalysis(...args),
}));

const { POST } = await import("./route");

/** A file whose leading bytes really are a PDF, so the sniff check passes. */
function pdf(name: string): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])], name, {
    type: "application/pdf",
  });
}

function request(fileCount: number): Request {
  const form = new FormData();
  for (let i = 0; i < fileCount; i += 1) form.append("files", pdf(`invoice-${i}.pdf`));
  return new Request("http://localhost/api/analyses", { method: "POST", body: form });
}

beforeEach(() => {
  runAnalysis.mockClear();
  insert.mockClear();
});

describe("POST /api/analyses batch size", () => {
  it("rejects a batch below the minimum and starts no analysis", async () => {
    const counts = [0, 1, MIN_FILES_PER_ANALYSIS - 1];
    const outcomes = await Promise.all(
      counts.map(async (count) => {
        const response = await POST(request(count));
        return { count, status: response.status, body: await response.json() };
      }),
    );

    for (const outcome of outcomes) {
      expect(outcome.status, `${outcome.count} files`).toBe(400);
      expect(outcome.body, `${outcome.count} files`).toEqual({ error: "tooFew" });
    }

    // The damaging outcome is a half-empty analysis reaching the pipeline and
    // costing a model call, so assert nothing was started or written.
    expect(runAnalysis).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a batch above the maximum", async () => {
    const response = await POST(request(MAX_FILES_PER_ANALYSIS + 1));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "tooMany" });
    expect(runAnalysis).not.toHaveBeenCalled();
  });

  it("accepts a batch at the minimum", async () => {
    const response = await POST(request(MIN_FILES_PER_ANALYSIS));

    expect(response.status).toBe(201);
    expect(runAnalysis).toHaveBeenCalledTimes(1);
  });

  it("accepts a batch at the maximum", async () => {
    const response = await POST(request(MAX_FILES_PER_ANALYSIS));

    expect(response.status).toBe(201);
    expect(runAnalysis).toHaveBeenCalledTimes(1);
  });
});
