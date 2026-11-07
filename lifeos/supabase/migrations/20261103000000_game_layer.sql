-- LifeOS game layer: regions, evidence, XP ledger, rewards, game profile, private evidence storage.

alter table public.goals add column region text check (region in ('wealth','health','knowledge','career','social','mind'));
alter table public.tasks add column evidence text not null default 'none' check (evidence in ('none','photo','document','manual'));
alter table public.tasks add column evidence_criteria text not null default '';
alter table public.tasks add column xp_size text not null default 'auto' check (xp_size in ('auto','small','medium','major'));

create table public.task_evidence (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  task_id text not null,
  instance_key text not null,
  status text not null check (status in ('waiting','submitted','review','accepted','more','manual')),
  kind text not null check (kind in ('photo','document','manual')),
  -- private storage path inside the "evidence" bucket (never a public URL)
  file_ref text,
  note text not null default '',
  ai_verdict text check (ai_verdict in ('likely','unclear','unlikely')),
  ai_reason text not null default '',
  submitted_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, task_id) references public.tasks(user_id, id) on delete cascade
);
create index on public.task_evidence (user_id, instance_key);

-- XP ledger. Deterministic ids (e.g. "task:<id>") make awards idempotent: the same achievement
-- can never be stored twice for a user.
create table public.xp_events (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  kind text not null check (kind in ('task','occurrence','milestone','goal','habit','achievement','challenge','chest')),
  ref_id text not null,
  title text not null,
  amount integer not null check (amount between 0 and 10000),
  region text check (region in ('wealth','health','knowledge','career','social','mind')),
  attribute text not null check (attribute in ('strength','intelligence','wealth','discipline','career','social')),
  at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.rewards (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  title text not null check (char_length(title) between 1 and 120),
  note text not null default '',
  condition jsonb not null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.game_profile (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  display_name text not null default '',
  avatar jsonb not null default '{}'::jsonb,
  xp jsonb not null default '{}'::jsonb,
  season_start date not null,
  last_intro_date date,
  chests_opened jsonb not null default '[]'::jsonb,
  notify jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

do $$
declare t text;
begin
  foreach t in array array['task_evidence','xp_events','rewards','game_profile'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format($p$create policy "owner_select" on public.%I for select to authenticated using (user_id = (select auth.uid()))$p$, t);
    execute format($p$create policy "owner_insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))$p$, t);
    execute format($p$create policy "owner_update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$, t);
    execute format($p$create policy "owner_delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))$p$, t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- apply_batch: same function, with the new tables whitelisted.
create or replace function public.apply_batch(ops jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare
  op jsonb;
  t text;
  setlist text;
  cols text;
  row jsonb;
  uid uuid := auth.uid();
  allowed text[] := array[
    'goals','milestones','objectives','tasks','task_occurrences','calendar_events','habits','habit_logs',
    'meals','meal_weeks','meal_plan_entries','grocery_items','pantry_items','finance_accounts',
    'finance_entries','weight_logs','user_settings','goal_conversations','conversation_messages',
    'goal_profiles','goal_plan_versions','reminders','goal_progress_records',
    'task_evidence','xp_events','rewards','game_profile'];
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if jsonb_typeof(ops) <> 'array' or jsonb_array_length(ops) > 1000 then raise exception 'invalid ops'; end if;
  for op in select * from jsonb_array_elements(ops) loop
    t := op->>'table';
    if not (t = any(allowed)) then raise exception 'table not allowed: %', t; end if;
    if op->>'op' = 'upsert' then
      -- only the columns present in the row are written, so column defaults still apply
      row := (op->'row') || jsonb_build_object('user_id', uid);
      select string_agg(quote_ident(attname), ', '), string_agg(format('%I = excluded.%I', attname, attname), ', ') filter (where attname not in ('user_id', 'id'))
        into cols, setlist
        from pg_attribute
        where attrelid = format('public.%I', t)::regclass and attnum > 0 and not attisdropped and row ? attname::text;
      execute format(
        'insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) on conflict (user_id, id) do update set %s',
        t, cols, cols, t, coalesce(setlist, 'id = excluded.id'))
        using row;
    elsif op->>'op' = 'delete' then
      execute format('delete from public.%I where user_id = $1 and id = $2', t) using uid, op->>'id';
    else
      raise exception 'unknown op %', op->>'op';
    end if;
  end loop;
end $$;
revoke all on function public.apply_batch(jsonb) from public, anon;
grant execute on function public.apply_batch(jsonb) to authenticated;

-- Private storage for evidence photos (Supabase Storage). Each user can only read/write
-- objects under a folder named after their own user id. Skipped where the storage schema
-- doesn't exist (e.g. plain PostgreSQL in tests).
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('evidence', 'evidence', false) on conflict (id) do nothing;
    execute $p$create policy "evidence_owner_read" on storage.objects for select to authenticated using (bucket_id = 'evidence' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
    execute $p$create policy "evidence_owner_write" on storage.objects for insert to authenticated with check (bucket_id = 'evidence' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
    execute $p$create policy "evidence_owner_delete" on storage.objects for delete to authenticated using (bucket_id = 'evidence' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
  end if;
end $$;
