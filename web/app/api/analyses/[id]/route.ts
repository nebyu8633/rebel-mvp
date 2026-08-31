import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AnalysisRow } from "@/types/database";

/**
 * Analysis status, polled by the processing screen.
 *
 * Uses the caller's own client, so Row Level Security decides whether the row
 * is visible — another business's analysis id returns 404 rather than data.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data } = await supabase
    .from("analyses")
    .select(
      "id, status, steps, error_message, invoice_count, product_count, " +
        "supplier_count, opportunity_count, total_annual_opportunity_agorot, completed_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (data === null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(data as Partial<AnalysisRow>, {
    // Progress must never be served stale.
    headers: { "Cache-Control": "no-store" },
  });
}
