-- 0010_customer_user_details.sql  (additive)
-- Customer profile details (addresses, additional information, settings),
-- customer group creation dates, user profile details (username, outlets,
-- PIN / barcode for fast switching), tax-exclusive display prices and
-- single sign-on settings.

alter table customers add column if not exists details jsonb not null default '{}';
alter table customer_groups add column if not exists created_at timestamptz not null default now();
alter table users add column if not exists details jsonb not null default '{}';
alter table settings add column if not exists tax_exclusive boolean not null default false;
