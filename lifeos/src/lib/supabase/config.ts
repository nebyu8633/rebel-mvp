/** Supabase is enabled only when both public values are present. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const supabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
