-- 0012_postal_address.sql  (additive)
-- Separate postal (mailing) address for the store, shown in Setup → General
-- when "Use different address for postal address" is on.

alter table setup_config add column if not exists contact_postal jsonb not null default '{}';
