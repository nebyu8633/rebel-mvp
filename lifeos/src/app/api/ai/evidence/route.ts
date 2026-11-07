import { NextResponse } from "next/server";
import { AIError, EvidenceInput } from "@/lib/ai/provider";
import { getProvider } from "@/lib/ai/anthropic";
import { aiErrorResponse, guard } from "@/lib/ai/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Relevance check for an evidence photo. The image is sent by the signed-in user from their own
 * device, assessed, and NOT stored here (storage is private and handled client-side via RLS).
 * The answer is a relevance hint only — never proof; the user always decides.
 */
export async function POST(req: Request) {
  const g = await guard();
  if (g instanceof NextResponse) return g;
  const parsed = EvidenceInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "בקשה לא תקינה", code: "bad_request" }, { status: 400 });
  const provider = getProvider();
  if (!provider) return aiErrorResponse(new AIError("not_configured", "בדיקת AI לא זמינה (לא הוגדר מפתח). אפשר לאשר ידנית."));
  try {
    const verdict = await provider.assessEvidence(parsed.data);
    return NextResponse.json(verdict);
  } catch (e) {
    return aiErrorResponse(e);
  }
}
