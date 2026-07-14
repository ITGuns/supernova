-- ============================================================
-- Nova POS — Supabase Schema
-- Run this in the Supabase SQL editor (Database → SQL Editor).
-- All tables live in the public schema.
-- Row Level Security (RLS) is left OFF for now — enable per-table
-- once you have Supabase Auth wired up.
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Helpers ─────────────────────────────────────────────────
-- Automatically update the updated_at column on any row change.
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Store Settings ───────────────────────────────────────────
-- One row per store (single-tenant for now; extend with org_id later).
create table if not exists settings (
  id              uuid primary key default uuid_generate_v4(),
  store_name      text not null default 'Nova — Downtown',
  default_tax_label text not null default 'No Tax (0%)',
  default_tax_rate_bps int not null default 0,
  taxes           jsonb not null default '[]',
  updated_at      timestamptz not null default now()
);
create or replace trigger settings_updated_at
  before update on settings
  for each row execute procedure set_updated_at();

-- ── Setup / Back-office Config ───────────────────────────────
create table if not exists setup_config (
  id              uuid primary key default uuid_generate_v4(),
  currency        text not null default 'USD — United States Dollar',
  time_zone       text not null default '(UTC-05:00) Eastern Time (US & Canada)',
  sequence_number text not null default '10207',
  embedded_barcodes text not null default 'Disabled',
  gen_sku         boolean not null default true,
  auto_cust       boolean not null default false,
  combine_sku     boolean not null default true,
  diff_postal     boolean not null default false,
  hide_on_order   boolean not null default false,
  contact_first_name  text not null default '',
  contact_last_name   text not null default '',
  contact_email       text not null default '',
  contact_phone       text not null default '',
  contact_website     text not null default '',
  contact_twitter     text not null default '',
  contact_street1     text not null default '',
  contact_street2     text not null default '',
  contact_suburb      text not null default '',
  contact_city        text not null default '',
  contact_zip         text not null default '',
  contact_state       text not null default '',
  contact_country     text not null default 'United States',
  connected_apps  jsonb not null default '[]',
  on_account_enabled  boolean not null default true,
  on_account_limit    text not null default '',
  loyalty_enabled     boolean not null default false,
  loyalty_pct         int not null default 10,
  loyalty_redemption_min  boolean not null default false,
  loyalty_signup_bonus    boolean not null default false,
  loyalty_welcome_email   boolean not null default true,
  loyalty_expiry          text not null default 'Never',
  store_credit_enabled    boolean not null default true,
  saved_payment_enabled   boolean not null default false,
  billing_plan_id         text not null default 'core',
  billing_frequency       text not null default 'monthly',
  sales_target_minor      int not null default 0,
  payment_types   jsonb not null default '[]',
  outlets         jsonb not null default '[]',
  receipt_templates jsonb not null default '[]',
  updated_at      timestamptz not null default now()
);
create or replace trigger setup_config_updated_at
  before update on setup_config
  for each row execute procedure set_updated_at();

-- ── Users / Staff ────────────────────────────────────────────
create table if not exists users (
  id              text primary key,
  name            text not null,
  email           text not null unique,
  role            text not null default 'Staff',
  password        text not null,
  enabled         boolean not null default true,
  is_owner        boolean not null default false,
  av_color        text not null default '#4b3df5',
  last_seen       text not null default 'just now',
  target_daily_minor   int,
  target_weekly_minor  int,
  target_monthly_minor int,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create or replace trigger users_updated_at
  before update on users
  for each row execute procedure set_updated_at();

-- ── !! PROTECTED ACCOUNTS — DATABASE-LEVEL GUARD !! ──────────
-- Prevent ANY DELETE on the owner and Jade's admin account,
-- regardless of who calls it (app, SQL editor, migration script, etc.).
create or replace function protect_admin_accounts()
returns trigger language plpgsql as $$
begin
  if old.id in ('u-owner', 'u-jade') then
    raise exception
      'Cannot delete protected admin account: %. This account is system-protected.',
      old.id;
  end if;
  return old;
end;
$$;

drop trigger if exists users_protect_admins on users;
create trigger users_protect_admins
  before delete on users
  for each row execute procedure protect_admin_accounts();

-- ── Catalog Metadata (categories, brands, suppliers) ────────
create table if not exists catalog_meta (
  id          text primary key,
  kind        text not null check (kind in ('categories','brands','suppliers')),
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

-- ── Products ─────────────────────────────────────────────────
create table if not exists products (
  id              text primary key,
  product_id      text not null,
  name            text not null,
  category_id     text not null,
  price_minor     int not null default 0,
  tax_group_id    text not null default 'standard',
  sku             text not null default '',
  emoji           text not null default '',
  enabled         boolean not null default true,
  variants        int not null default 1,
  available       int not null default 0,
  brand           text not null default '',
  supplier        text not null default '',
  image           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create or replace trigger products_updated_at
  before update on products
  for each row execute procedure set_updated_at();

-- ── Customers ────────────────────────────────────────────────
create table if not exists customers (
  id              text primary key,
  first_name      text not null default '',
  last_name       text not null default '',
  email           text,
  phone           text,
  address         text,
  city            text,
  state           text,
  zip             text,
  country         text,
  "group"         text not null default 'All Customers',
  notes           text,
  loyalty_points  int not null default 0,
  store_credit_minor int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create or replace trigger customers_updated_at
  before update on customers
  for each row execute procedure set_updated_at();

-- ── Customer Groups ──────────────────────────────────────────
create table if not exists customer_groups (
  id    serial primary key,
  name  text not null unique
);
insert into customer_groups (name) values ('All Customers'), ('VIP'), ('Wholesale')
  on conflict do nothing;

-- ── Sales (completed transactions) ──────────────────────────
create table if not exists sales (
  order_number    text primary key,
  lines           jsonb not null default '[]',
  total_minor     int not null default 0,
  tenders         jsonb not null default '[]',
  change_minor    int not null default 0,
  sold_at         timestamptz not null default now(),
  training        boolean not null default false,
  customer_name   text,
  note            text,
  sold_by         text,
  status          text not null default 'Completed',
  created_at      timestamptz not null default now()
);

-- ── Parked Sales ─────────────────────────────────────────────
create table if not exists parked_sales (
  id          text primary key,
  label       text not null,
  lines       jsonb not null default '[]',
  parked_at   timestamptz not null default now()
);

-- ── Quotes ───────────────────────────────────────────────────
create table if not exists quotes (
  id          text primary key,
  num         text not null unique,
  customer    text not null default '',
  total_minor int not null default 0,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  status      text not null default 'Draft'
);

-- ── Inventory Transactions (POs, Transfers, Returns) ─────────
create table if not exists stock_transactions (
  id          text primary key,
  kind        text not null check (kind in ('order','transfer','return')),
  number      text not null unique,
  "from"      text not null default '',
  "to"        text not null default '',
  status      text not null default 'Draft',
  created_at  timestamptz not null default now(),
  due_at      timestamptz,
  lines       jsonb not null default '[]'
);

-- ── Inventory Counts ─────────────────────────────────────────
create table if not exists inventory_counts (
  id          text primary key,
  name        text not null,
  outlet      text not null default '',
  status      text not null default 'In progress',
  created_at  timestamptz not null default now()
);

-- ── Register Sessions ────────────────────────────────────────
create table if not exists register_sessions (
  id          uuid primary key default uuid_generate_v4(),
  status      text not null default 'open',
  opened_at   timestamptz,
  opening_float_minor int not null default 0,
  closure_seq int not null default 1,
  movements   jsonb not null default '[]',
  closures    jsonb not null default '[]',
  updated_at  timestamptz not null default now()
);
create or replace trigger register_sessions_updated_at
  before update on register_sessions
  for each row execute procedure set_updated_at();

-- ── Register Config ──────────────────────────────────────────
create table if not exists register_config (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null default 'Register 1',
  training_mode   boolean not null default false,
  updated_at      timestamptz not null default now()
);
create or replace trigger register_config_updated_at
  before update on register_config
  for each row execute procedure set_updated_at();

-- ── Security / PIN config ────────────────────────────────────
create table if not exists security_config (
  id                uuid primary key default uuid_generate_v4(),
  pin_enabled       boolean not null default false,
  pin_hash          text,
  idle_lock_seconds int not null default 300,
  updated_at        timestamptz not null default now()
);
create or replace trigger security_config_updated_at
  before update on security_config
  for each row execute procedure set_updated_at();

-- ── Adjustment Reasons ───────────────────────────────────────
create table if not exists adjustment_reasons (
  id    text primary key,
  name  text not null,
  kind  text not null default 'loss'
);

-- ── Seed singleton config rows ───────────────────────────────
insert into settings (id) values ('00000000-0000-0000-0000-000000000001') on conflict do nothing;
insert into setup_config (id) values ('00000000-0000-0000-0000-000000000002') on conflict do nothing;
insert into register_sessions (id) values ('00000000-0000-0000-0000-000000000003') on conflict do nothing;
insert into register_config (id) values ('00000000-0000-0000-0000-000000000004') on conflict do nothing;
insert into security_config (id) values ('00000000-0000-0000-0000-000000000005') on conflict do nothing;

-- ── Seed protected admin accounts ────────────────────────────
-- These rows are inserted once and can never be deleted (trigger above).
insert into users (id, name, email, role, password, enabled, is_owner, av_color, last_seen)
values
  ('u-owner', 'Alex Kim',    'alex@nova.local',           'Account owner, Admin', 'alex1234', true, true,  '#4b3df5', 'just now'),
  ('u-jade',  'Jade Tatom',  'jade.tatom@nova.local',     'Admin',                'jade1234', true, false, '#7c3aed', 'just now')
on conflict (id) do nothing;
