import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/** Email-confirmation / magic-link landing: exchanges the code for a session cookie. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const sb = await getServerSupabase();
  if (sb && code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/login?error=callback", url.origin));
  }
  return NextResponse.redirect(new URL("/", url.origin));
}
