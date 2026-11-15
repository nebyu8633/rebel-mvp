-- LifeOS — background reminder scheduler (Supabase pg_cron + pg_net, free, inside your project).
-- Calls /api/cron/reminders every minute. NOT a migration: it needs your own values, run it once in
-- the Supabase SQL editor AFTER the app is deployed with all push env vars (see README "התראות").
-- Secrets live in Supabase Vault, never in this file or in the repository.

-- 1) extensions (also available under Database → Extensions)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2) secrets — replace the two values, run once (re-running creates duplicates: use vault.update_secret to change)
select vault.create_secret('https://YOUR-APP.vercel.app', 'lifeos_app_url');
select vault.create_secret('PASTE_THE_SAME_CRON_SECRET_AS_IN_VERCEL', 'lifeos_cron_secret');

-- 3) every minute
select cron.schedule(
  'lifeos-reminders',
  '* * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'lifeos_app_url') || '/api/cron/reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'lifeos_cron_secret')),
    timeout_milliseconds := 55000
  );
  $$
);

-- check that it runs (status 200 and {"ok":true,...} in the response body):
--   select jobid, status, start_time from cron.job_run_details order by start_time desc limit 5;
--   select status_code, content from net._http_response order by created desc limit 5;
-- stop / rollback:
--   select cron.unschedule('lifeos-reminders');
--   delete from vault.secrets where name in ('lifeos_app_url', 'lifeos_cron_secret');
