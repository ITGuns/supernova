-- 0002_hash_passwords.sql
-- Staff passwords were stored in plaintext. The app now compares SHA-256
-- hashes (src/lib/password.ts) and still accepts a plaintext match for any
-- row not yet migrated, so this can run before or after the deploy.
-- Idempotent: rows that are already 64-char hex hashes are left alone.

create extension if not exists pgcrypto;

update users
   set password = encode(digest(password, 'sha256'), 'hex')
 where password !~ '^[0-9a-f]{64}$';
