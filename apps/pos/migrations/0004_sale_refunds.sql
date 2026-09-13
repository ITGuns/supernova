-- 0004_sale_refunds.sql  (additive)
-- A return now issues a refund to the sale's original tenders. Record what
-- was refunded and when, so the till (cash out) and payment reports balance.

alter table sales add column if not exists refund_tenders jsonb not null default '[]';
alter table sales add column if not exists refunded_at timestamptz;
