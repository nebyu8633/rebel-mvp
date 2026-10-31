import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Tells the client whether an AI provider is configured — never exposes the key. */
export async function GET() {
  return NextResponse.json({ configured: Boolean(process.env.ANTHROPIC_API_KEY), provider: process.env.ANTHROPIC_API_KEY ? "anthropic" : null });
}
