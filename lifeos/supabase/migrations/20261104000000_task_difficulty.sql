-- Dynamic quest difficulty & XP evaluation.
-- The AI rates tasks; the server computes levels and XP. Users can READ their evaluations and XP
-- ledger but can no longer write them — only the server (service role) does.

alter table public.tasks add column parent_task_id text;
alter table public.tasks add column actual_minutes integer check (actual_minutes between 0 and 1440);
create index on public.tasks (user_id, parent_task_id);

alter table public.xp_events add column detail text not null default '';
alter table public.xp_events add column eval_version integer;
alter table public.xp_events drop constraint xp_events_kind_check;
alter table public.xp_events add constraint xp_events_kind_check check (kind in ('task','occurrence','milestone','goal','habit','achievement','challenge','chest','unlock'));

create table public.task_evaluations (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  task_id text not null,
  original_description text not null,
  clarified_scope text not null default '',
  answers jsonb not null default '[]'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  dims jsonb not null,
  score numeric(4,2) not null check (score between 1 and 5),
  difficulty integer not null check (difficulty between 1 and 5),
  estimated_minutes integer not null check (estimated_minutes between 1 and 1440),
  steps integer not null default 1 check (steps between 1 and 100),
  personal_minutes integer check (personal_minutes between 1 and 1440),
  familiarity text not null default 'new' check (familiarity in ('new','some','experienced')),
  xp integer not null check (xp between 0 and 1000),
  explanation text not null,
  reasons jsonb not null default '[]'::jsonb,
  source text not null check (source in ('ai','rules')),
  repeat_key text not null,
  duplicate_of text,
  parent_task_id text,
  content_hash text not null,
  evaluation_version integer not null,
  locked_at timestamptz,
  previous jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, task_id) references public.tasks(user_id, id) on delete cascade
);

-- read-only for the owner; written only by the server (service role)
do $$
declare t text;
begin
  foreach t in array array['task_evaluations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format($p$create policy "owner_select" on public.%I for select to authenticated using (user_id = (select auth.uid()))$p$, t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

-- XP ledger becomes server-written only
drop policy if exists "owner_insert" on public.xp_events;
drop policy if exists "owner_update" on public.xp_events;
drop policy if exists "owner_delete" on public.xp_events;
revoke insert, update, delete on public.xp_events from authenticated;

-- apply_batch: xp_events removed from the whitelist (task_evaluations was never in it)
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
    'task_evidence','rewards','game_profile'];
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if jsonb_typeof(ops) <> 'array' or jsonb_array_length(ops) > 1000 then raise exception 'invalid ops'; end if;
  for op in select * from jsonb_array_elements(ops) loop
    t := op->>'table';
    if not (t = any(allowed)) then raise exception 'table not allowed: %', t; end if;
    if op->>'op' = 'upsert' then
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
