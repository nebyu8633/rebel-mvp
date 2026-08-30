-- ===========================================================================
-- Restaurant Purchasing Intelligence — initial schema
--
-- Run this once in the Supabase SQL editor before first use.
--
-- Isolation model: every business-scoped table carries `business_id`, and
-- every RLS policy resolves it through `businesses.owner_id = auth.uid()`.
-- One business can never read, write, or even count another's rows.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- businesses — one per authenticated user (including anonymous users, which
-- Supabase converts in place when they sign up, keeping the same id).
-- ---------------------------------------------------------------------------
create table if not exists public.businesses (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id) on delete cascade,
  name         text not null default '',
  owner_name   text not null default '',
  currency     text not null default 'ILS',
  country      text not null default 'IL',
  language     text not null default 'he',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- One business per user in V1. Multi-location would drop this constraint.
create unique index if not exists businesses_owner_id_key
  on public.businesses (owner_id);

-- ---------------------------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------------------------
create table if not exists public.suppliers (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,
  name            text not null,
  normalized_name text not null,
  created_at      timestamptz not null default now()
);

create index if not exists suppliers_business_id_idx
  on public.suppliers (business_id);

-- Supplier identity is scoped to the business: two restaurants may both buy
-- from "בשר הצפון" and those are separate, unlinked supplier rows.
create unique index if not exists suppliers_business_normalized_name_key
  on public.suppliers (business_id, normalized_name);

-- ---------------------------------------------------------------------------
-- products
--
-- `normalized_name` is the exact-match key produced by normalizeName().
-- `specification` holds markers such as טרי / קפוא / אורגני, which are part of
-- product identity — fresh and frozen must never collapse into one product.
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,
  canonical_name  text not null,
  normalized_name text not null,
  category        text,
  brand           text,
  specification   text[] not null default '{}',
  default_unit    text,
  base_unit       text,
  confidence      numeric(4, 3) not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists products_business_id_idx
  on public.products (business_id);

create unique index if not exists products_business_normalized_name_key
  on public.products (business_id, normalized_name);

-- ---------------------------------------------------------------------------
-- analyses — one per upload batch, drives the processing screen.
-- ---------------------------------------------------------------------------
create table if not exists public.analyses (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  status        text not null default 'pending'
                check (status in ('pending', 'processing', 'complete', 'error')),
  -- Per-step state for the six-step processing UI, e.g.
  -- {"uploading": "complete", "reading": "processing", ...}
  steps         jsonb not null default '{}'::jsonb,
  error_message text,
  invoice_count      integer not null default 0,
  product_count      integer not null default 0,
  supplier_count     integer not null default 0,
  opportunity_count  integer not null default 0,
  -- Headline figure in agorot, so no float ever touches stored money.
  total_annual_opportunity_agorot bigint not null default 0,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists analyses_business_id_idx
  on public.analyses (business_id, created_at desc);

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------
create table if not exists public.invoices (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,
  supplier_id     uuid references public.suppliers (id) on delete set null,
  analysis_id     uuid references public.analyses (id) on delete set null,
  invoice_number  text,
  invoice_date    date,
  currency        text not null default 'ILS',
  total_amount_agorot bigint,
  -- Storage object path inside the private `invoices` bucket. Never a public
  -- URL — the file is only ever served through a short-lived signed URL.
  file_path       text,
  file_name       text,
  status          text not null default 'processed'
                  check (status in ('processed', 'needs_review', 'failed')),
  extraction_confidence numeric(4, 3),
  created_at      timestamptz not null default now()
);

create index if not exists invoices_business_id_idx
  on public.invoices (business_id, invoice_date desc);
create index if not exists invoices_supplier_id_idx
  on public.invoices (supplier_id);
create index if not exists invoices_analysis_id_idx
  on public.invoices (analysis_id);
create index if not exists invoices_invoice_number_idx
  on public.invoices (business_id, invoice_number);

-- Duplicate guard: the same supplier cannot bill the same invoice number
-- twice for one business. Rows without a number are exempt — there is
-- nothing reliable to compare.
create unique index if not exists invoices_business_supplier_number_key
  on public.invoices (business_id, supplier_id, invoice_number)
  where invoice_number is not null;

-- ---------------------------------------------------------------------------
-- invoice_items
--
-- Both the raw and the normalized view of every line are kept: raw_* is what
-- the supplier actually printed (auditable), normalized_* is what the engine
-- compares.
-- ---------------------------------------------------------------------------
create table if not exists public.invoice_items (
  id                    uuid primary key default gen_random_uuid(),
  invoice_id            uuid not null references public.invoices (id) on delete cascade,
  business_id           uuid not null references public.businesses (id) on delete cascade,
  product_id            uuid references public.products (id) on delete set null,
  raw_product_name      text not null,
  normalized_name       text not null,
  sku                   text,
  quantity              numeric(14, 4),
  unit                  text,
  unit_price_agorot     bigint,
  total_price_agorot    bigint,
  -- Quantity restated in base units (kg / liter / unit / box / pack / case).
  base_quantity         numeric(14, 4),
  base_unit             text,
  -- Price per base unit, in ten-thousandths of a shekel. Needs more precision
  -- than agorot: ₪0.0123/gram would round to ₪0.01, a 22% error.
  normalized_unit_price integer,
  comparable            boolean not null default false,
  not_comparable_reason text,
  confidence            numeric(4, 3) not null default 0,
  created_at            timestamptz not null default now()
);

create index if not exists invoice_items_invoice_id_idx
  on public.invoice_items (invoice_id);
create index if not exists invoice_items_product_id_idx
  on public.invoice_items (product_id);
create index if not exists invoice_items_business_id_idx
  on public.invoice_items (business_id);

-- ---------------------------------------------------------------------------
-- price_records — the price history the historical comparison reads.
--
-- Denormalized from invoice_items so a history lookup is one indexed scan
-- rather than a three-table join on every product.
-- ---------------------------------------------------------------------------
create table if not exists public.price_records (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references public.businesses (id) on delete cascade,
  supplier_id           uuid references public.suppliers (id) on delete cascade,
  product_id            uuid not null references public.products (id) on delete cascade,
  invoice_item_id       uuid references public.invoice_items (id) on delete cascade,
  normalized_unit_price integer not null,
  base_unit             text not null,
  base_quantity         numeric(14, 4),
  observed_at           date not null,
  confidence            numeric(4, 3) not null default 0,
  created_at            timestamptz not null default now()
);

-- The exact shape of the history query: business + supplier + product,
-- most recent first.
create index if not exists price_records_lookup_idx
  on public.price_records (business_id, supplier_id, product_id, observed_at desc);

-- ---------------------------------------------------------------------------
-- benchmarks — GLOBAL reference prices (Mode B).
--
-- Ships EMPTY, deliberately. The product must never show a fabricated market
-- price (spec §24): with no rows here, every comparison falls back to the
-- user's own history and the UI says "אין מספיק נתוני השוואה" rather than
-- inventing one. Populate only from a real, citable source.
-- ---------------------------------------------------------------------------
create table if not exists public.benchmarks (
  id                    uuid primary key default gen_random_uuid(),
  normalized_name       text not null,
  category              text,
  base_unit             text not null,
  benchmark_unit_price  integer not null,
  source                text not null,
  region                text not null default 'IL',
  valid_from            date not null,
  valid_to              date,
  created_at            timestamptz not null default now()
);

create index if not exists benchmarks_lookup_idx
  on public.benchmarks (normalized_name, base_unit, valid_from desc);

-- ---------------------------------------------------------------------------
-- savings_opportunities
--
-- Every row records how it was calculated, from what source, at what
-- confidence and when (spec §59), so "how was this calculated?" is always
-- answerable from stored data rather than recomputed guesswork.
-- ---------------------------------------------------------------------------
create table if not exists public.savings_opportunities (
  id                       uuid primary key default gen_random_uuid(),
  business_id              uuid not null references public.businesses (id) on delete cascade,
  analysis_id              uuid not null references public.analyses (id) on delete cascade,
  product_id               uuid not null references public.products (id) on delete cascade,
  supplier_id              uuid references public.suppliers (id) on delete set null,
  invoice_item_id          uuid references public.invoice_items (id) on delete set null,
  current_unit_price       integer not null,
  reference_unit_price     integer not null,
  price_difference         integer not null,
  percentage_change        numeric(8, 5),
  base_unit                text not null,
  observed_quantity        numeric(14, 4) not null,
  estimated_annual_quantity numeric(14, 4) not null,
  annual_opportunity_agorot  bigint not null,
  monthly_opportunity_agorot bigint not null,
  is_annualized            boolean not null default false,
  calculation_method       text not null
                           check (calculation_method in ('historical', 'benchmark')),
  benchmark_source         text,
  confidence               numeric(4, 3) not null default 0,
  calculated_at            timestamptz not null default now()
);

create index if not exists savings_opportunities_analysis_idx
  on public.savings_opportunities (analysis_id, annual_opportunity_agorot desc);
create index if not exists savings_opportunities_business_idx
  on public.savings_opportunities (business_id, calculated_at desc);
create index if not exists savings_opportunities_product_idx
  on public.savings_opportunities (product_id);

-- ===========================================================================
-- Row Level Security
--
-- Enabled on every table. Without a policy the default is deny, so a table
-- that is enabled but unpoliced is unreadable rather than public.
-- ===========================================================================

alter table public.businesses            enable row level security;
alter table public.suppliers             enable row level security;
alter table public.products              enable row level security;
alter table public.analyses              enable row level security;
alter table public.invoices              enable row level security;
alter table public.invoice_items         enable row level security;
alter table public.price_records         enable row level security;
alter table public.savings_opportunities enable row level security;
alter table public.benchmarks            enable row level security;

-- Resolves the caller's business ids. STABLE + SECURITY INVOKER so it is
-- inlined by the planner and still subject to the caller's own permissions.
create or replace function public.current_business_ids()
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select id from public.businesses where owner_id = auth.uid();
$$;

-- businesses: a user sees exactly their own row.
drop policy if exists businesses_select on public.businesses;
create policy businesses_select on public.businesses
  for select using (owner_id = auth.uid());

drop policy if exists businesses_insert on public.businesses;
create policy businesses_insert on public.businesses
  for insert with check (owner_id = auth.uid());

drop policy if exists businesses_update on public.businesses;
create policy businesses_update on public.businesses
  for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists businesses_delete on public.businesses;
create policy businesses_delete on public.businesses
  for delete using (owner_id = auth.uid());

-- Every business-scoped table gets the identical four policies. Generated in
-- a loop so a new table cannot accidentally ship with a weaker rule than its
-- siblings.
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'suppliers', 'products', 'analyses', 'invoices',
    'invoice_items', 'price_records', 'savings_opportunities'
  ]
  loop
    execute format('drop policy if exists %I_select on public.%I', target_table, target_table);
    execute format(
      'create policy %I_select on public.%I for select
         using (business_id in (select public.current_business_ids()))',
      target_table, target_table);

    execute format('drop policy if exists %I_insert on public.%I', target_table, target_table);
    execute format(
      'create policy %I_insert on public.%I for insert
         with check (business_id in (select public.current_business_ids()))',
      target_table, target_table);

    execute format('drop policy if exists %I_update on public.%I', target_table, target_table);
    execute format(
      'create policy %I_update on public.%I for update
         using (business_id in (select public.current_business_ids()))
         with check (business_id in (select public.current_business_ids()))',
      target_table, target_table);

    execute format('drop policy if exists %I_delete on public.%I', target_table, target_table);
    execute format(
      'create policy %I_delete on public.%I for delete
         using (business_id in (select public.current_business_ids()))',
      target_table, target_table);
  end loop;
end
$$;

-- benchmarks: global reference data. Readable by any signed-in user; writable
-- only by the service role, which bypasses RLS. No user-facing write policy
-- exists, so a user cannot inject a benchmark and manufacture a saving.
drop policy if exists benchmarks_select on public.benchmarks;
create policy benchmarks_select on public.benchmarks
  for select using (auth.role() = 'authenticated');

-- ===========================================================================
-- Storage — private bucket for uploaded invoice files.
--
-- Object path is `{business_id}/{invoice_id}/{filename}`, so the first path
-- segment is the ownership key the policies check.
-- ===========================================================================

insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

drop policy if exists invoices_storage_select on storage.objects;
create policy invoices_storage_select on storage.objects
  for select using (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] in (
      select public.current_business_ids()::text
    )
  );

drop policy if exists invoices_storage_insert on storage.objects;
create policy invoices_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] in (
      select public.current_business_ids()::text
    )
  );

drop policy if exists invoices_storage_delete on storage.objects;
create policy invoices_storage_delete on storage.objects
  for delete using (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] in (
      select public.current_business_ids()::text
    )
  );

-- ===========================================================================
-- updated_at maintenance
-- ===========================================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists businesses_touch_updated_at on public.businesses;
create trigger businesses_touch_updated_at
  before update on public.businesses
  for each row execute function public.touch_updated_at();
