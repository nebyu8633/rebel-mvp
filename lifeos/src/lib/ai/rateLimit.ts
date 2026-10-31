import "server-only";

/** Simple per-user sliding-window limiter (per server instance) to cap AI spend. */
const hits = new Map<string, number[]>();

export function checkRateLimit(userId: string, limit = 12, windowMs = 60_000): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const arr = (hits.get(userId) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    hits.set(userId, arr);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - arr[0])) / 1000) };
  }
  arr.push(now);
  hits.set(userId, arr);
  return { ok: true, retryAfter: 0 };
}
