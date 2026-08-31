import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseConfigured } from "@/lib/config/env";

/** Routes that require a signed-in, non-anonymous user. */
const PROTECTED_PREFIXES = ["/dashboard"];

/**
 * Refreshes the Supabase session on every request and guards protected routes.
 *
 * Session refresh has to happen in middleware: server components cannot write
 * cookies, so without this an expired token would never be renewed and the
 * user would be silently signed out mid-visit.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  // With no Supabase project configured the app still needs to serve its
  // public pages, so pass everything through untouched.
  if (!isSupabaseConfigured()) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() revalidates the token against Supabase. getSession() only reads
  // the cookie, which a client could have forged, so it must not gate access.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  // An anonymous user has an account but has not signed up yet, so the
  // dashboard is not theirs to see — they are sent to sign up, not to log in.
  if (isProtected && (user === null || user.is_anonymous === true)) {
    const target = request.nextUrl.clone();
    target.pathname = user === null ? "/login" : "/signup";
    target.searchParams.set("redirect", pathname);
    return NextResponse.redirect(target);
  }

  return response;
}
