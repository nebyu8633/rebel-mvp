-- LifeOS initial schema
-- Every table is per-user: primary key (user_id, id), user_id defaults to auth.uid(),
-- and Row Level Security restricts every operation to the signed-in owner.
-- Column names are the snake_case form of the app's Zod schema fields (src/lib/types.ts);
-- src/lib/__tests__/migration.test.ts verifies they stay in sync.

create extension if not exists pgcrypto;

-- ───────── goals ─────────
create table public.goals (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  title text not null check (char_length(title) between 2 and 120),
  description text not null default '',
  why text not null default '',
  kind text not null check (kind in ('motorcycle','weight','portfolio','custom')),
  status text not null check (status in ('planning','active','paused','done')),
  start_date date not null,
  start_confirmed boolean not null default false,
  target_date date not null,
  unit text not null default '',
  start_value numeric(14,2),
  target_value numeric(14,2),
  manual_value numeric(14,2),
  finance_account_id text,
  info jsonb not null default '{}'::jsonb,
  color text not null default 'teal',
  "order" double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.milestones (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  goal_id text not null,
  title text not null,
  description text not null default '',
  target_date date,
  status text not null check (status in ('pending','active','done')),
  "order" double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, goal_id) references public.goals(user_id, id) on delete cascade
);
create index on public.milestones (user_id, goal_id);

create table public.objectives (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  goal_id text not null,
  milestone_id text,
  level text not null check (level in ('month','week')),
  period_start date not null,
  title text not null,
  status text not null check (status in ('pending','done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, goal_id) references public.goals(user_id, id) on delete cascade,
  foreign key (user_id, milestone_id) references public.milestones(user_id, id) on delete cascade
);

-- ───────── tasks ─────────
create table public.tasks (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  title text not null check (char_length(title) between 1 and 200),
  notes text not null default '',
  goal_id text,
  milestone_id text,
  objective_id text,
  priority text not null default 'medium' check (priority in ('high','medium','low')),
  estimated_minutes integer check (estimated_minutes between 0 and 1440),
  date date,
  start_time text check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  deadline date,
  status text not null default 'planned' check (status in ('planned','in_progress','completed','skipped','postponed')),
  recurrence jsonb,
  reminder_minutes integer check (reminder_minutes between 0 and 1440),
  rationale text not null default '',
  depends_on jsonb not null default '[]'::jsonb,
  routine text check (routine in ('grocery','meal_prep','weekly_review')),
  source text not null default 'user',
  completed_at timestamptz,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, goal_id) references public.goals(user_id, id) on delete set null (goal_id),
  foreign key (user_id, milestone_id) references public.milestones(user_id, id) on delete set null (milestone_id),
  foreign key (user_id, objective_id) references public.objectives(user_id, id) on delete set null (objective_id)
);
create index on public.tasks (user_id, date);
create index on public.tasks (user_id, goal_id);

-- One row per touched occurrence of a recurring task; id = "<task_id>:<original_date>"
-- so the same occurrence can never be stored twice.
create table public.task_occurrences (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  task_id text not null,
  original_date date not null,
  status text not null check (status in ('planned','in_progress','completed','skipped','postponed')),
  date date,
  start_time text check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  title text,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, task_id, original_date),
  foreign key (user_id, task_id) references public.tasks(user_id, id) on delete cascade
);

create table public.calendar_events (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  title text not null,
  date date not null,
  start_time text check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  location text not null default '',
  notes text not null default '',
  recurrence jsonb,
  reminder_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ───────── habits ─────────
create table public.habits (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  title text not null,
  goal_id text,
  frequency jsonb not null,
  start_date date not null,
  paused boolean not null default false,
  reminder_time text check (reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  "order" double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, goal_id) references public.goals(user_id, id) on delete set null (goal_id)
);

create table public.habit_logs (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  habit_id text not null,
  date date not null,
  status text not null check (status in ('done','skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, habit_id, date),
  foreign key (user_id, habit_id) references public.habits(user_id, id) on delete cascade
);

-- ───────── meals & groceries ─────────
create table public.meals (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  portions integer not null default 1 check (portions between 1 and 100),
  ingredients jsonb not null default '[]'::jsonb,
  prep_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.meal_weeks (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  week_start date not null,
  approved boolean not null default false,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.meal_plan_entries (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  date date not null,
  slot text not null check (slot in ('breakfast','lunch','dinner','snack')),
  meal_id text not null,
  portions numeric(6,2) not null default 1,
  prep_date date,
  prepared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, meal_id) references public.meals(user_id, id) on delete cascade
);
create index on public.meal_plan_entries (user_id, date);

create table public.grocery_items (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  week_start date not null,
  name text not null,
  quantity numeric(12,2),
  unit text not null default '',
  purchased boolean not null default false,
  source text not null check (source in ('plan','manual')),
  key text not null default '',
  plan_quantity numeric(12,2),
  adjusted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index on public.grocery_items (user_id, week_start);

create table public.pantry_items (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  quantity numeric(12,2) not null,
  unit text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ───────── finance & body ─────────
create table public.finance_accounts (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  kind text not null check (kind in ('savings','portfolio')),
  goal_id text,
  target numeric(14,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, goal_id) references public.goals(user_id, id) on delete set null (goal_id)
);

create table public.finance_entries (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  account_id text not null,
  date date not null,
  kind text not null check (kind in ('deposit','withdrawal','valuation')),
  amount numeric(14,2) not null check (amount >= 0),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, account_id) references public.finance_accounts(user_id, id) on delete cascade
);

create table public.weight_logs (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  date date not null,
  kg numeric(6,2) not null check (kg between 20 and 400),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.user_settings (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  display_name text not null default '',
  timezone text not null default 'Asia/Jerusalem',
  week_starts_on smallint not null default 0,
  availability jsonb not null,
  meal_reminders jsonb not null default '[]'::jsonb,
  notify_in_app boolean not null default true,
  notify_browser boolean not null default false,
  default_reminder_minutes integer not null default 15,
  meal_prep_day smallint,
  meal_prep_backup_day smallint,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Note: goals.finance_account_id intentionally has no FK (finance_accounts.goal_id already
-- references goals; a second FK would make the pair impossible to insert one row at a time).

-- ───────── Row Level Security ─────────
do $$
declare t text;
begin
  foreach t in array array[
    'goals','milestones','objectives','tasks','task_occurrences','calendar_events',
    'habits','habit_logs','meals','meal_weeks','meal_plan_entries','grocery_items',
    'pantry_items','finance_accounts','finance_entries','weight_logs','user_settings'
  ] loop
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
