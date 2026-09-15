-- 0005_product_details.sql  (additive)
-- The product editor is now a full page with the same sections as a
-- Lightspeed product: description, tags, images, product type (standard /
-- variant / composite), multiple SKU codes, multiple suppliers, per-product
-- tax, supplier price + markup, inventory replenishment settings, packaging
-- relationships and shipping details. productStore feature-detects these
-- columns, so the app can deploy before or after this runs.

alter table products add column if not exists description         text    not null default '';
alter table products add column if not exists tags                jsonb   not null default '[]';
alter table products add column if not exists sell_on_pos         boolean not null default true;
alter table products add column if not exists product_type        text    not null default 'standard';
alter table products add column if not exists attributes          jsonb   not null default '[]';
alter table products add column if not exists sku_codes           jsonb   not null default '[]';
alter table products add column if not exists suppliers           jsonb   not null default '[]';
alter table products add column if not exists tax_id              text    not null default '';
alter table products add column if not exists supplier_price_minor int    not null default 0;
alter table products add column if not exists track_inventory     boolean not null default true;
alter table products add column if not exists replenish_method    text    not null default 'minmax';
alter table products add column if not exists min_qty             int;
alter table products add column if not exists max_qty             int;
alter table products add column if not exists reorder_point       int;
alter table products add column if not exists reorder_qty         int;
alter table products add column if not exists location            text    not null default '';
alter table products add column if not exists components          jsonb   not null default '[]';
alter table products add column if not exists comes_from          jsonb   not null default '[]';
alter table products add column if not exists breaks_into         jsonb   not null default '[]';
alter table products add column if not exists images              jsonb   not null default '[]';
alter table products add column if not exists shipping            jsonb   not null default '{}';
