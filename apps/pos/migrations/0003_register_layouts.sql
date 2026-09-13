-- 0003_register_layouts.sql  (additive)
-- Quick-key layouts were localStorage-only, so every device had its own
-- grid. registerStore now syncs them here; it feature-detects the column,
-- so this can run before or after the app deploy.

alter table register_config add column if not exists layouts jsonb not null default '[]';
alter table register_config add column if not exists current_layout_id text;
alter table register_config add column if not exists quick_keys_enabled boolean not null default true;
