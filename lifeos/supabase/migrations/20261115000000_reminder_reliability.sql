-- LifeOS: reminder reliability (additive only — no existing column or row is changed in meaning).
-- 1) delivery status per reminder (claimed → sent / failed / partial), so the app can show what
--    actually happened instead of assuming success;
-- 2) server-side snoozes, so a snoozed reminder also arrives when the app is closed.
-- Rollback: supabase/rollback/20261115000000_reminder_reliability.down.sql
-- The app keeps working without this migration (it detects the missing columns/table).

-- ───────── 1. delivery status ─────────
-- Existing rows were delivered by the old scheduler → backfilled as 'sent'; new claims start as 'claimed'.
alter table public.push_deliveries
  add column if not exists status text not null default 'sent',
  add column if not exists error text,
  add column if not exists devices integer,
  add column if not exists delivered integer,
  add column if not exists late boolean not null default false;
alter table public.push_deliveries alter column status set default 'claimed';
do $$ begin
  alter table public.push_deliveries add constraint push_deliveries_status_check check (status in ('claimed','sent','partial','failed'));
exception when duplicate_object then null; end $$;
create index if not exists push_deliveries_user_sent on public.push_deliveries (user_id, sent_at desc);

-- ───────── 2. server-side snoozes ─────────
create table if not exists public.reminder_snoozes (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  reminder_key text not null,
  instance_key text,
  title text not null check (char_length(title) between 1 and 300),
  body text not null default '',
  -- an in-app path only: "/x", never "//host" or "/\host" (would open another site on tap)
  href text not null default '/today' check (href ~ '^/([^/\\]|$)'),
  fire_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists reminder_snoozes_due on public.reminder_snoozes (fire_at);
alter table public.reminder_snoozes enable row level security;
alter table public.reminder_snoozes force row level security;
drop policy if exists "owner_select" on public.reminder_snoozes;
drop policy if exists "owner_insert" on public.reminder_snoozes;
drop policy if exists "owner_delete" on public.reminder_snoozes;
create policy "owner_select" on public.reminder_snoozes for select to authenticated using (user_id = (select auth.uid()));
create policy "owner_insert" on public.reminder_snoozes for insert to authenticated with check (user_id = (select auth.uid()));
create policy "owner_delete" on public.reminder_snoozes for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.reminder_snoozes from anon;
grant select, insert, delete on public.reminder_snoozes to authenticated;
