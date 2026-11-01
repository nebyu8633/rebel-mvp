-- LifeOS: conversational goal planning, plan versions, multiple reminders, progress records,
-- transactional batch writes and Web Push subscriptions.

alter table public.goals drop constraint if exists goals_kind_check;
alter table public.goals add constraint goals_kind_check
  check (kind in ('motorcycle','weight','portfolio','purchase','income','learning','custom'));

alter table public.tasks add column plan_version_id text;
alter table public.milestones add column plan_version_id text;

create table public.goal_conversations (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  goal_id text not null,
  mode text not null default 'basic' check (mode in ('basic','ai')),
  phase text not null check (phase in ('discovery','plan_draft','active','revising')),
  stage smallint not null check (stage between 1 and 8),
  pending jsonb,
  skipped jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, goal_id) references public.goals(user_id, id) on delete cascade
);

create table public.conversation_messages (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  goal_id text not null,
  role text not null check (role in ('user','assistant','system')),
  text text not null check (char_length(text) <= 8000),
  question jsonb,
  answer_key text,
  source text not null default 'basic' check (source in ('basic','ai','app')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, goal_id) references public.goals(user_id, id) on delete cascade
);
create index on public.conversation_messages (user_id, goal_id, created_at);

create table public.goal_profiles (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  goal_id text not null,
  facts jsonb not null default '{}'::jsonb,
  unresolved jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, goal_id) references public.goals(user_id, id) on delete cascade
);

create table public.goal_plan_versions (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  goal_id text not null,
  version integer not null check (version >= 1),
  status text not null check (status in ('draft','approved','superseded','discarded')),
  plan jsonb not null,
  based_on_version_id text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, goal_id, version),
  foreign key (user_id, goal_id) references public.goals(user_id, id) on delete cascade
);

-- Approved snapshots are immutable: once approved, only the status may move to 'superseded'.
create or replace function public.guard_plan_version() returns trigger language plpgsql as $$
begin
  if old.status in ('approved','superseded') then
    if new.plan is distinct from old.plan or new.version <> old.version or new.goal_id <> old.goal_id
       or new.approved_at is distinct from old.approved_at then
      raise exception 'approved plan versions are immutable';
    end if;
    if not (new.status = old.status or (old.status = 'approved' and new.status = 'superseded')) then
      raise exception 'invalid plan version status change % -> %', old.status, new.status;
    end if;
  end if;
  return new;
end $$;
create trigger plan_version_immutable before update on public.goal_plan_versions
  for each row execute function public.guard_plan_version();

create table public.reminders (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  task_id text not null,
  kind text not null check (kind in ('before_start','before_deadline','at')),
  minutes integer check (minutes between 0 and 20160),
  date date,
  time text check (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, task_id) references public.tasks(user_id, id) on delete cascade
);

create table public.goal_progress_records (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  goal_id text not null,
  metric_key text not null default 'main',
  date date not null,
  value double precision not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, goal_id) references public.goals(user_id, id) on delete cascade
);

-- Web Push (optional; used only when VAPID keys + a scheduler are configured).
create table public.push_subscriptions (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
-- Written only by the server-side scheduler (service role) to prevent duplicate pushes.
create table public.push_deliveries (
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, reminder_key)
);

do $$
declare t text;
begin
  foreach t in array array['goal_conversations','conversation_messages','goal_profiles','goal_plan_versions','reminders','goal_progress_records','push_subscriptions'] loop
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
alter table public.push_deliveries enable row level security;
alter table public.push_deliveries force row level security;
create policy "owner_select" on public.push_deliveries for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.push_deliveries from anon;
grant select on public.push_deliveries to authenticated;

-- ───────── Transactional batch writes ─────────
-- Applies a list of upserts/deletes in ONE transaction (all or nothing). SECURITY INVOKER:
-- RLS still applies, and user_id is always forced to the caller — a client cannot write rows
-- for anyone else. Only whitelisted app tables can be touched.
create or replace function public.apply_batch(ops jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare
  op jsonb;
  t text;
  setlist text;
  uid uuid := auth.uid();
  allowed text[] := array[
    'goals','milestones','objectives','tasks','task_occurrences','calendar_events','habits','habit_logs',
    'meals','meal_weeks','meal_plan_entries','grocery_items','pantry_items','finance_accounts',
    'finance_entries','weight_logs','user_settings','goal_conversations','conversation_messages',
    'goal_profiles','goal_plan_versions','reminders','goal_progress_records'];
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if jsonb_typeof(ops) <> 'array' or jsonb_array_length(ops) > 1000 then raise exception 'invalid ops'; end if;
  for op in select * from jsonb_array_elements(ops) loop
    t := op->>'table';
    if not (t = any(allowed)) then raise exception 'table not allowed: %', t; end if;
    if op->>'op' = 'upsert' then
      select string_agg(format('%I = excluded.%I', attname, attname), ', ') into setlist
        from pg_attribute
        where attrelid = format('public.%I', t)::regclass and attnum > 0 and not attisdropped
          and attname not in ('user_id', 'id');
      execute format(
        'insert into public.%I select * from jsonb_populate_record(null::public.%I, $1) on conflict (user_id, id) do update set %s',
        t, t, setlist)
        using (op->'row') || jsonb_build_object('user_id', uid);
    elsif op->>'op' = 'delete' then
      execute format('delete from public.%I where user_id = $1 and id = $2', t) using uid, op->>'id';
    else
      raise exception 'unknown op %', op->>'op';
    end if;
  end loop;
end $$;
revoke all on function public.apply_batch(jsonb) from public, anon;
grant execute on function public.apply_batch(jsonb) to authenticated;
