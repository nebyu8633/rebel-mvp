import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next 16's `proxy` convention (formerly `middleware`). Runs on every matched
 * request to refresh the Supabase session and guard the dashboard.
 */
export default async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Every path except static assets and image files. Running the session
     * refresh on those would add a Supabase round trip to every icon request
     * for no benefit.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
