-- 0011_checkout_parity.sql  (additive)
-- Gift cards, advanced promotions, partial returns, custom field values and
-- tax-exclusive pricing as the default (prices shown without tax, tax added
-- at the register — the behaviour the register already had).

create table if not exists gift_cards (
  id             text primary key,
  number         text not null unique,
  initial_minor  int  not null,
  balance_minor  int  not null,
  customer_name  text not null default '',
  note           text not null default '',
  status         text not null default 'Active',       -- Active | Redeemed | Cancelled
  sale_order_number text,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz
);

alter table promotions add column if not exists advanced jsonb;                              -- buy X get Y / spend thresholds
alter table sales add column if not exists returned_lines jsonb;                             -- { "<line index>": qty returned }
alter table sales add column if not exists custom_fields jsonb not null default '{}';
alter table products add column if not exists custom_fields jsonb not null default '{}';
alter table services add column if not exists custom_fields jsonb not null default '{}';
alter table settings alter column tax_exclusive set default true;
update settings set tax_exclusive = true where id = '00000000-0000-0000-0000-000000000001';
