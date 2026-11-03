/**
 * Environment configuration.
 *
 * Reads are lazy and explicit rather than validated at module load, because
 * the app must still build and render its static pages on a machine that has
 * no Supabase project configured. A missing variable fails loudly at the point
 * of use, with a message naming the variable and what to do about it — never
 * as an opaque crash inside a vendor SDK.
 */

export class MissingEnvError extends Error {
  constructor(name: string) {
    super(
      `Missing required environment variable ${name}. ` +
        `Copy .env.example to .env.local and fill it in — see README.md.`,
    );
    this.name = "MissingEnvError";
  }
}

function required(name: string, value: string | undefined): string {
  if (value === undefined || value.trim() === "") throw new MissingEnvError(name);
  return value;
}

/**
 * Public Supabase config. Safe in the browser: the anon key only grants what
 * Row Level Security allows.
 *
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time, so these must be
 * referenced as full static property accesses, not through a dynamic lookup.
 */
export function getSupabasePublicConfig(): { url: string; anonKey: string } {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: required(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
  };
}

/** True when Supabase is configured, for rendering a setup notice instead of crashing. */
export function isSupabaseConfigured(): boolean {
  return (
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

/**
 * Service-role key. Bypasses Row Level Security, so this must only ever be
 * read in server-side code. The `server-only` import in admin.ts is what
 * actually enforces that; this function just fetches the value.
 */
export function getServiceRoleKey(): string {
  return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface AiConfig {
  apiKey: string;
  provider: string;
  model: string;
}

export function getAiConfig(): AiConfig {
  return {
    apiKey: required("AI_API_KEY", process.env.AI_API_KEY),
    provider: process.env.AI_PROVIDER ?? "anthropic",
    model: process.env.AI_MODEL ?? "claude-opus-5",
  };
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY);
}

function numberFromEnv(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Minimum extraction confidence before a line item may drive a savings
 * opportunity automatically (spec §19). Configurable, never hardcoded.
 */
export function getMinConfidence(): number {
  return numberFromEnv(process.env.MIN_CONFIDENCE, 0.85);
}

export function getPriceHistoryWindowDays(): number {
  return numberFromEnv(process.env.PRICE_HISTORY_WINDOW_DAYS, 365);
}

/** Demo Mode shows clearly-labelled fictional data. Never enable in production. */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}
