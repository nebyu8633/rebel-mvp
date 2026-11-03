import { NextResponse } from "next/server";

import { deleteInvoiceFile } from "@/lib/supabase/storage";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { InvoiceRow } from "@/types/database";

/**
 * Deletes an invoice and its stored file (spec §47).
 *
 * Runs on the caller's own client, so Row Level Security decides what may be
 * deleted — another business's invoice id is simply not found. The
 * `invoice_items`, and through them the `price_records`, cascade in the
 * schema, so removing an invoice also removes its contribution to the price
 * history rather than leaving orphaned prices behind.
 */
export async function DELETE(
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

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, file_path")
    .eq("id", id)
    .maybeSingle();

  if (invoice === null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Remove the row first. If the storage delete then fails, the user still
  // cannot reach the file (the bucket is private and the row is gone), whereas
  // deleting the file first could leave a row pointing at nothing.
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error !== null) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  const filePath = (invoice as Pick<InvoiceRow, "file_path">).file_path;
  if (filePath !== null) {
    await deleteInvoiceFile(supabase, filePath);
  }

  return NextResponse.json({ ok: true });
}
