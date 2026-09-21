-- Where a sale happened, so Reporting can group by it the way Lightspeed does
-- (Report type → Outlet / Register / Sales channel). Promotions ride along on
-- each line inside the existing `lines` jsonb, so they need no column here.
alter table sales add column if not exists outlet text;
alter table sales add column if not exists register text;
alter table sales add column if not exists channel text;

notify pgrst, 'reload schema';
