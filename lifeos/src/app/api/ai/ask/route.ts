import { NextResponse } from "next/server";
import { z } from "zod";
import { AIContext, AIError } from "@/lib/ai/provider";
import { getProvider } from "@/lib/ai/anthropic";
import { aiErrorResponse, guard } from "@/lib/ai/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({ question: z.string().trim().min(2).max(1000), context: AIContext });

/**
 * The client sends a bounded snapshot of its own data. In cloud mode that data was read
 * through RLS with the user's session, and this route requires the same session, so the
 * model only ever sees the signed-in user's own records.
 */
export async function POST(req: Request) {
  const g = await guard();
  if (g instanceof NextResponse) return g;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "בקשה לא תקינה", code: "bad_request" }, { status: 400 });
  const provider = getProvider();
  if (!provider) return aiErrorResponse(new AIError("not_configured", "לא הוגדר מפתח AI בשרת."));
  try {
    const answer = await provider.ask(parsed.data.question, parsed.data.context);
    return NextResponse.json({ answer, source: provider.name });
  } catch (e) {
    return aiErrorResponse(e);
  }
}
