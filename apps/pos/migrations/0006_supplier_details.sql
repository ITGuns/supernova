-- 0006_supplier_details.sql  (additive)
-- Suppliers get a full profile (default markup, contact details, physical
-- and mailing addresses), edited on a dedicated page. Stored as JSON on the
-- existing catalog_meta row so brands and categories are untouched.
-- catalogMetaStore probes for the column, so the app can deploy before or
-- after this runs.

alter table catalog_meta add column if not exists details jsonb not null default '{}';
