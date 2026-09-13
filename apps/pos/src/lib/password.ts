/**
 * password.ts — one-way hashing for staff login passwords.
 *
 * Passwords were stored and compared in plaintext (in the users table, in
 * localStorage, and in the shipped JS). Hashing with SHA-256 means the stored
 * value can't be read back as the password. This is client-side only — a
 * server-issued session is the eventual fix — but it stops plaintext at rest.
 *
 * Verification also accepts a legacy plaintext match so existing accounts keep
 * working before the DB migration rewrites them; on that path the caller
 * should re-save the user with the hashed value to upgrade in place.
 */

const HEX64 = /^[0-9a-f]{64}$/;

export const isHashed = (s: string): boolean => HEX64.test(s);

export async function hashPassword(plain: string): Promise<string> {
  const bytes = new TextEncoder().encode(plain);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** True when `plain` matches `stored` (hashed, or legacy plaintext). */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!stored) return false;
  if (isHashed(stored)) return (await hashPassword(plain)) === stored;
  return plain === stored;
}
