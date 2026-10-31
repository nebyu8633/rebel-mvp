import "server-only";
import { NextResponse } from "next/server";
import { AIError } from "./provider";
import { getRequestUser } from "../supabase/server";
import { checkRateLimit } from "./rateLimit";

export function aiErrorResponse(e: unknown) {
  if (e instanceof AIError) {
    const status = e.code === "not_configured" ? 503 : e.code === "rate_limited" ? 429 : e.code === "auth" ? 502 : e.code === "invalid_output" ? 502 : e.code === "refused" ? 422 : 502;
    return NextResponse.json({ error: e.message, code: e.code, retryAfter: e.retryAfter }, { status });
  }
  console.error("AI route error", e);
  return NextResponse.json({ error: "שגיאה לא צפויה", code: "unavailable" }, { status: 500 });
}

/** Auth + rate limit guard shared by AI routes. Returns a user or a ready error response. */
export async function guard(): Promise<{ userId: string } | NextResponse> {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר", code: "unauthenticated" }, { status: 401 });
  const rl = checkRateLimit(user.id);
  if (!rl.ok) return NextResponse.json({ error: "יותר מדי בקשות. נסו שוב בעוד רגע.", code: "rate_limited", retryAfter: rl.retryAfter }, { status: 429 });
  return { userId: user.id };
}
