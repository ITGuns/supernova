-- 0001_qa_fixes.sql
-- Schema fixes surfaced during the full-app QA pass.
--   1. customers: add the `code` and `account_minor` columns the app writes.
--   2. parked_sales: persist discount, customer and note so a parked sale
--      restores exactly as it was rung up.
--   3. catalog_meta: remove duplicate category/brand/supplier rows and add a
--      unique (kind, name) guard so imports can't reintroduce them.

begin;

-- ── 1. customers ─────────────────────────────────────────────────────────────
alter table customers add column if not exists code text;
alter table customers add column if not exists account_minor int not null default 0;

-- ── 2. parked_sales ──────────────────────────────────────────────────────────
alter table parked_sales add column if not exists discount_bps int not null default 0;
alter table parked_sales add column if not exists customer_name text;
alter table parked_sales add column if not exists note text;

-- ── 3. catalog_meta dedup ────────────────────────────────────────────────────
-- Keep one row per (kind, name). For categories, prefer an id already
-- referenced by a product so existing products keep a valid category.
delete from catalog_meta cm
using (
  select id from (
    select id,
           row_number() over (
             partition by kind, name
             order by (id in (select distinct category_id from products)) desc, id
           ) as rn
    from catalog_meta
  ) ranked
  where ranked.rn > 1
) dupes
where cm.id = dupes.id;

alter table catalog_meta
  drop constraint if exists catalog_meta_kind_name_key;
alter table catalog_meta
  add constraint catalog_meta_kind_name_key unique (kind, name);

commit;
