import { NextResponse } from "next/server";
import { pushServerConfig } from "@/lib/push/config";

export const dynamic = "force-dynamic";

/** Reports whether background push can work — never exposes secrets, only which settings are missing. */
export async function GET() {
  const { ready, missing } = pushServerConfig();
  return NextResponse.json({ available: ready, missing: ready ? [] : missing });
}
