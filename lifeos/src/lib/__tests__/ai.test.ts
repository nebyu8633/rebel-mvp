import { describe, expect, it } from "vitest";
import { AnthropicProvider } from "../ai/anthropic";
import { AIError } from "../ai/provider";
import { PlanInput } from "../planner/schema";
import { fallbackPlan } from "../planner/fallback";

const input = PlanInput.parse({ kind: "custom", title: "ללמוד גיטרה", startDate: "2026-11-01", targetDate: "2027-11-01" });

function mockFetch(status: number, body: unknown, seen?: { body?: Record<string, unknown>; headers?: Headers }) {
  return (async (_url: RequestInfo | URL, init?: RequestInit) => {
    if (seen) {
      seen.body = JSON.parse(String(init?.body));
      seen.headers = new Headers(init?.headers);
    }
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "retry-after": "7" } });
  }) as typeof fetch;
}

const message = (text: string, stop = "end_turn") => ({
  id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason: stop, stop_sequence: null,
  content: [{ type: "text", text }], usage: { input_tokens: 1, output_tokens: 1 },
});

describe("Anthropic provider (mocked transport)", () => {
  it("sends a structured-output request and returns a schema-valid plan", async () => {
    const plan = fallbackPlan(input, "2026-11-01");
    const seen: { body?: Record<string, unknown>; headers?: Headers } = {};
    const p = new AnthropicProvider("test-key", undefined, { fetch: mockFetch(200, message(JSON.stringify(plan)), seen), maxRetries: 0 });
    const out = await p.plan(input, "2026-11-01");
    expect(out.milestones.length).toBe(plan.milestones.length);
    expect(seen.body?.model).toBe("claude-opus-5-5");
    expect((seen.body?.output_config as { format: { type: string } }).format.type).toBe("json_schema");
    expect(seen.body?.fallbacks).toBe("default");
    expect(seen.headers?.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
  });

  it("rejects malformed model output instead of inventing a plan", async () => {
    const p = new AnthropicProvider("k", undefined, { fetch: mockFetch(200, message('{"summary": 1}')), maxRetries: 0 });
    await expect(p.plan(input, "2026-11-01")).rejects.toBeInstanceOf(AIError);
  });

  it("maps rate limits and auth errors to typed errors", async () => {
    const rl = new AnthropicProvider("k", undefined, { fetch: mockFetch(429, { type: "error", error: { type: "rate_limit_error", message: "x" } }), maxRetries: 0 });
    await expect(rl.ask("מה לעשות?", {} as never)).rejects.toMatchObject({ code: "rate_limited", retryAfter: 7 });
    const au = new AnthropicProvider("k", undefined, { fetch: mockFetch(401, { type: "error", error: { type: "authentication_error", message: "x" } }), maxRetries: 0 });
    await expect(au.ask("מה לעשות?", {} as never)).rejects.toMatchObject({ code: "auth" });
  });

  it("treats refusals and empty answers as failures", async () => {
    const r = new AnthropicProvider("k", undefined, { fetch: mockFetch(200, { ...message(""), stop_reason: "refusal" }), maxRetries: 0 });
    await expect(r.ask("שאלה", {} as never)).rejects.toMatchObject({ code: "refused" });
    const e = new AnthropicProvider("k", undefined, { fetch: mockFetch(200, message("   ")), maxRetries: 0 });
    await expect(e.ask("שאלה", {} as never)).rejects.toMatchObject({ code: "invalid_output" });
  });
});
