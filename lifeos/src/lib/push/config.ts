/** Web Push is available only when Supabase + VAPID keys + a service-role key (server) are configured. */
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function pushServerConfig() {
  const cfg = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    vapidPublic: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
    vapidPrivate: process.env.VAPID_PRIVATE_KEY ?? "",
    vapidSubject: process.env.VAPID_SUBJECT ?? "",
    cronSecret: process.env.CRON_SECRET ?? "",
  };
  const missing = Object.entries(cfg)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  return { cfg, ready: missing.length === 0, missing };
}
