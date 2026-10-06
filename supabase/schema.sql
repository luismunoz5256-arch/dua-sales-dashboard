-- Dua Food Sales Dashboard — database schema
-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
-- Single-user app: every table is readable/writable by any signed-in user,
-- so turn OFF "Allow new users to sign up" (Authentication > Sign In / Providers)
-- after creating your own login.

create extension if not exists pgcrypto;

-- Clients and leads live in one table. status = 'lead' uses lead_stage for the pipeline.
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text,
  phone text,
  address text,
  lat double precision,
  lng double precision,
  area text,
  status text not null default 'lead' check (status in ('lead','active','at_risk','inactive')),
  lead_stage text check (lead_stage in ('new','contacted','sampled_quoted','won','lost')),
  product_lines text[] not null default '{}',     -- produce, commercial_juice, cold_pressed, prepped_veg, other
  other_products text,
  order_frequency text,                           -- daily, 3x_week, 2x_week, weekly, biweekly, monthly, irregular
  typical_order_size numeric,
  last_order_date date,
  last_order_amount numeric,
  preferred_contact text check (preferred_contact in ('visit','call','text')),
  notes text,
  account_start_date date,                        -- first order / became active (drives "new account" boost)
  source text,                                    -- manual, csv, prospect_finder, quickbooks
  google_place_id text,
  qb_customer_name text,                          -- exact QuickBooks customer name, for future CSV import matching
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists interactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  date date not null default current_date,
  type text not null check (type in ('visit','call','text','sample_drop','quote_sent','order')),
  notes text,
  outcome text,
  next_step text,
  next_step_due date,
  created_at timestamptz not null default now()
);
create index if not exists interactions_client_idx on interactions(client_id, date desc);

create table if not exists followups (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  task text not null,
  due_date date not null,
  done boolean not null default false,
  done_at timestamptz,
  interaction_id uuid references interactions(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists followups_due_idx on followups(done, due_date);

-- One row per order. Entered by hand now; a QuickBooks CSV export maps straight onto this.
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  date date not null default current_date,
  amount numeric,
  product_lines text[] not null default '{}',
  source text not null default 'manual',          -- manual, quickbooks
  qb_ref text,                                    -- QuickBooks invoice / sales receipt number (dedupe on import)
  created_at timestamptz not null default now()
);
create index if not exists orders_client_idx on orders(client_id, date desc);

create table if not exists week_plan (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  client_id uuid not null references clients(id) on delete cascade,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists week_plan_date_idx on week_plan(date);

-- Per-date overrides: warehouse day, day off. id is the date as text (YYYY-MM-DD).
create table if not exists day_status (
  id text primary key,
  kind text not null check (kind in ('field','warehouse','off')),
  note text
);

-- Prospect Finder results the user acted on (saved / dismissed / added to leads).
create table if not exists prospects (
  id uuid primary key default gen_random_uuid(),
  google_place_id text unique not null,
  name text not null,
  status text not null default 'new' check (status in ('new','saved','dismissed','added')),
  fit_score numeric,
  data jsonb not null default '{}',               -- cached place details
  client_id uuid references clients(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Server-side cache of Google Places searches so repeat searches cost nothing.
create table if not exists places_cache (
  key text primary key,
  results jsonb not null,
  fetched_at timestamptz not null default now()
);

-- App settings (weights, thresholds, areas, goals, home base) as one JSON document.
create table if not exists settings (
  id text primary key default 'main',
  data jsonb not null default '{}'
);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text unique not null,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

-- Row level security: signed-in user only.
do $$
declare t text;
begin
  foreach t in array array['clients','interactions','followups','orders','week_plan','day_status',
                           'prospects','places_cache','settings','push_subscriptions'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "signed in" on %I', t);
    execute format('create policy "signed in" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
