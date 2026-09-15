-- 0007_inventory_workflows.sql  (additive)
-- Lightspeed-style catalog and inventory workflows:
--   * product tags become first-class rows (a tag can exist with no products),
--   * adjustment reasons get a Positive/Negative type plus an enabled flag and
--     the same default reasons Lightspeed ships with,
--   * purchase orders / stock receipts and inventory counts keep their full
--     form data (supplier invoice, delivery dates, note, discounts, shipping,
--     import duty, count schedule, filters and counted lines) as JSON.
-- Every store probes for these columns, so the app can deploy before or
-- after this runs.

create table if not exists product_tags (
  id          text primary key,
  name        text not null,
  created_at  timestamptz not null default now()
);

alter table adjustment_reasons add column if not exists enabled boolean not null default true;

insert into adjustment_reasons (id, name, kind, enabled) values
  ('damage',          'Damage',          'Negative', true),
  ('donation',        'Donation',        'Negative', true),
  ('expiry',          'Expiry',          'Negative', true),
  ('internal-use',    'Internal Use',    'Negative', true),
  ('theft',           'Theft',           'Negative', true),
  ('sample-for-sale', 'Sample For Sale', 'Positive', true),
  ('stock-found',     'Stock Found',     'Positive', true)
on conflict (id) do nothing;

alter table stock_transactions add column if not exists details jsonb not null default '{}';
alter table inventory_counts  add column if not exists details jsonb not null default '{}';
