-- Hero Arena: saved teams (player-written), arena profile and match history (game-server-written).
create table public.arena_teams (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  name text not null check (char_length(name) between 1 and 40),
  heroes jsonb not null check (jsonb_typeof(heroes) = 'array' and jsonb_array_length(heroes) = 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.arena_profiles (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null default 'arena',
  hero_xp jsonb not null default '{}'::jsonb,
  rating jsonb not null default '{}'::jsonb,
  matches integer not null default 0 check (matches >= 0),
  wins integer not null default 0 check (wins >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.arena_matches (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  mode text not null check (mode in ('duel','ffa','team2','team3','crystal')),
  map_id text not null,
  won boolean not null,
  draw boolean not null,
  result jsonb not null,
  players jsonb not null default '[]'::jsonb,
  duration integer not null check (duration >= 0),
  played_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index on public.arena_matches (user_id, played_at desc);

do $$
declare t text;
begin
  -- saved teams: full owner access
  foreach t in array array['arena_teams'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format($p$create policy "owner_select" on public.%I for select to authenticated using (user_id = (select auth.uid()))$p$, t);
    execute format($p$create policy "owner_insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))$p$, t);
    execute format($p$create policy "owner_update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$, t);
    execute format($p$create policy "owner_delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))$p$, t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
  -- results & Hero XP: read-only for the owner; only the game server (service role) writes
  foreach t in array array['arena_profiles','arena_matches'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format($p$create policy "owner_select" on public.%I for select to authenticated using (user_id = (select auth.uid()))$p$, t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

-- apply_batch: arena_teams added to the whitelist
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
    'task_evidence','rewards','game_profile','arena_teams'];
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
