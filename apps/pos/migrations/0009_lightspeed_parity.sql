-- 0009_lightspeed_parity.sql  (additive)
-- Everything the Lightspeed-parity pass needs: layaway / on-account / voided
-- sales, quote notes, promotion targeting and schedules, customer account
-- limits, inventory adjustments, services, time cards, serial numbers,
-- custom fields, tax groups and per-outlet default taxes.
-- Every store probes for these columns/tables, so the app can deploy before
-- or after this runs.

alter table sales add column if not exists paid_minor int;                -- null = paid in full (older rows)
alter table sales add column if not exists voided_at timestamptz;
alter table sales add column if not exists fulfillment jsonb;             -- { kind, status } for unfulfilled sales

alter table quotes add column if not exists note text not null default '';

alter table promotions add column if not exists target text not null default 'everyone';   -- 'everyone' | 'group' | 'code'
alter table promotions add column if not exists customer_groups jsonb not null default '[]';
alter table promotions add column if not exists promo_code text not null default '';
alter table promotions add column if not exists outlets jsonb not null default '[]';        -- [] = all outlets
alter table promotions add column if not exists schedule jsonb not null default '{}';       -- { kind: 'once'|'recurring', days, allDay, from, to }
alter table promotions add column if not exists earn_loyalty boolean not null default true;

alter table customers add column if not exists on_account_limit_minor int;                  -- null = store default
alter table customers add column if not exists loyalty_enabled boolean not null default true;

alter table settings add column if not exists tax_groups jsonb not null default '[]';        -- [{ id, name, taxIds }]
alter table setup_config add column if not exists outlet_taxes jsonb not null default '{}';  -- { [outletId]: taxId }

create table if not exists inventory_adjustments (
  id            text primary key,
  product_id    text not null,
  product_name  text not null default '',
  outlet        text not null default '',
  reason_id     text,
  reason        text not null default '',
  quantity      int  not null,                 -- signed
  cost_minor    int  not null default 0,       -- supplier cost per unit at the time
  note          text not null default '',
  "user"        text not null default '',
  created_at    timestamptz not null default now()
);

create table if not exists services (
  id                text primary key,
  number            text not null,
  customer_name     text not null default '',
  item              jsonb not null default '{}',   -- { name, serial, description, condition }
  status            text not null default 'New',
  assigned_user     text not null default '',
  location          text not null default '',
  description       text not null default '',
  duration_min      int  not null default 0,
  scheduled_at      timestamptz,
  notes             jsonb not null default '[]',   -- [{ id, text, by, at, visibleToCustomer }]
  lines             jsonb not null default '[]',
  sale_order_number text,
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);

create table if not exists service_statuses (
  id        text primary key,
  name      text not null,
  position  int  not null default 0,
  system    boolean not null default false
);
insert into service_statuses (id, name, position, system) values
  ('new', 'New', 0, true), ('ready', 'Ready To Start', 1, false), ('in-progress', 'In Progress', 2, false),
  ('awaiting-customer', 'Awaiting Customer', 3, false), ('awaiting-part', 'Awaiting Part', 4, false),
  ('completed', 'Completed', 98, true), ('cancelled', 'Cancelled', 99, true)
on conflict (id) do nothing;

create table if not exists time_entries (
  id         text primary key,
  user_name  text not null,
  clock_in   timestamptz not null,
  clock_out  timestamptz
);

create table if not exists serial_numbers (
  id                 text primary key,
  serial             text not null,
  product_id         text not null,
  product_name       text not null default '',
  outlet             text not null default '',
  status             text not null default 'In stock',   -- 'In stock' | 'Sold'
  sold_at            timestamptz,
  sale_order_number  text,
  created_at         timestamptz not null default now()
);

create table if not exists custom_fields (
  id           text primary key,
  name         text not null,
  application  text not null default 'Retail POS',
  entity       text not null default 'Product',      -- Customer | Product | Sale | Sale line item
  type         text not null default 'Text',
  created_at   timestamptz not null default now()
);
