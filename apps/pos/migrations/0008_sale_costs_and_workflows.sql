-- 0008_sale_costs_and_workflows.sql  (additive)
--   * sales keep the tax and discount they were charged with, so reports can
--     show revenue excluding tax and real gross profit (each sale line also
--     carries the product's supplier cost at the time of sale, inside `lines`),
--   * quotes keep their lines so a quote can be loaded back into the register,
--   * promotions, price books and fulfillments become first-class rows.
-- Every store probes for these columns/tables, so the app can deploy before
-- or after this runs.

alter table sales  add column if not exists tax_minor      int not null default 0;
alter table sales  add column if not exists discount_minor int not null default 0;
alter table quotes add column if not exists lines          jsonb not null default '[]';
alter table quotes add column if not exists discount_bps   int not null default 0;

create table if not exists promotions (
  id          text primary key,
  name        text not null,
  description text not null default '',
  kind        text not null default 'percent',   -- 'percent' | 'amount' | 'fixed'
  value       int  not null default 0,           -- percent: basis points (1050 = 10.5%); amount/fixed: minor units
  applies_to  text not null default 'all',       -- 'all' | 'categories' | 'products'
  target_ids  jsonb not null default '[]',
  start_at    timestamptz,
  end_at      timestamptz,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists price_books (
  id             text primary key,
  name           text not null,
  customer_group text not null default 'All Customers',
  outlet         text not null default '',
  start_at       timestamptz,
  end_at         timestamptz,
  entries        jsonb not null default '[]',   -- [{ productId, priceMinor }]
  created_at     timestamptz not null default now()
);

create table if not exists fulfillments (
  id            text primary key,
  number        text not null,
  kind          text not null default 'pickup',  -- 'pack' | 'pickup' | 'delivery'
  customer_name text not null default '',
  lines         jsonb not null default '[]',
  discount_bps  int  not null default 0,
  note          text not null default '',
  status        text not null default 'Open',    -- 'Open' | 'Completed' | 'Cancelled'
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);
