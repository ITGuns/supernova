import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbUsers } from '../lib/db';
import { hashPassword, isHashed, verifyPassword } from '../lib/password';

// Single source of truth for staff/users, shared across Setup → Users,
// Reporting → User reports, the profile drawer, and login authentication.

// ── Protected accounts ───────────────────────────────────────────────────────
// These IDs can NEVER be deleted or disabled — they are seeded admin accounts.
const PROTECTED_USER_IDS = new Set(['u-owner', 'u-jade']);
/** Profile fields from the Add user page (migration 0010 stores them in users.details). */
export interface UserDetails {
  username: string;
  /** Outlet names the user can work at; [] = all outlets. */
  outlets: string[];
  /** Fast switching: a 4-digit PIN and/or a barcode on their ID card. */
  pin: string;
  barcode: string;
  picture: string;
  customFields: Record<string, string>;
}

export const EMPTY_USER_DETAILS: UserDetails = { username: '', outlets: [], pin: '', barcode: '', picture: '', customFields: {} };

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: string;
  password: string;
  enabled: boolean;
  owner?: boolean;
  av: string;
  last: string;
  /** Sales targets in minor units (Setup → Users → edit). */
  targetDailyMinor?: number;
  targetWeeklyMinor?: number;
  targetMonthlyMinor?: number;
  details?: UserDetails;
}

// Whether the cloud users table has the details column (migration 0010).
let hasUserDetails = true;

export const initials = (n: string) =>
  n
    .split(' ')
    .map((s) => s.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

// Map between AppUser (camelCase) and the DB row (snake_case).
const toRow = (u: AppUser): Record<string, unknown> => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  password: u.password,
  enabled: u.enabled,
  is_owner: u.owner ?? false,
  av_color: u.av,
  last_seen: u.last,
  target_daily_minor: u.targetDailyMinor ?? null,
  target_weekly_minor: u.targetWeeklyMinor ?? null,
  target_monthly_minor: u.targetMonthlyMinor ?? null,
  ...(hasUserDetails ? { details: u.details ?? {} } : {}),
});

const fromRow = (r: Record<string, unknown>): AppUser => ({
  id: r.id as string,
  name: r.name as string,
  email: r.email as string,
  role: r.role as string,
  password: r.password as string,
  enabled: r.enabled as boolean,
  owner: (r.is_owner as boolean) ?? false,
  av: r.av_color as string,
  last: r.last_seen as string,
  targetDailyMinor: (r.target_daily_minor as number | null) ?? undefined,
  targetWeeklyMinor: (r.target_weekly_minor as number | null) ?? undefined,
  targetMonthlyMinor: (r.target_monthly_minor as number | null) ?? undefined,
  details: { ...EMPTY_USER_DETAILS, ...((r.details as Partial<UserDetails> | null) ?? {}) },
});

const INIT: AppUser[] = [
  { id: 'u-owner', name: 'Alex Kim', email: 'alex@nova.local', role: 'Account owner, Admin', password: 'alex1234', enabled: true, owner: true, av: '#4b3df5', last: 'just now' },
  { id: 'u-jade', name: 'Jade Savage', email: 'jade.savage@nova.local', role: 'Admin', password: 'jade1234', enabled: true, av: '#7c3aed', last: 'just now' },
];

interface UserState {
  users: AppUser[];
  currentUserId: string | null;
  /** Epoch ms when the current user clocked in, or null when clocked out. */
  clockedInAt: number | null;
  /** Pull users from Supabase and merge into local state. */
  syncFromDb: () => Promise<void>;
  addUser: (u: Omit<AppUser, 'id'>) => void;
  updateUser: (id: string, patch: Partial<AppUser>) => void;
  deleteUser: (id: string) => void;
  toggleUser: (id: string) => void;
  /** Resolves the user on a correct email + password; null otherwise. */
  authenticate: (email: string, password: string) => Promise<AppUser | null>;
  setCurrentUser: (id: string) => void;
  /** End the session: no current user until someone logs in again. */
  logout: () => void;
  clockIn: () => void;
  clockOut: () => void;
}

export const useUsers = create<UserState>()(
  persist(
    (set, get) => ({
      users: INIT,
      // Nobody is logged in until the login screen sets this; RequireUser
      // sends visitors there.
      currentUserId: null,
      clockedInAt: null,

      syncFromDb: async () => {
        const [rows, probe] = await Promise.all([dbUsers.list(), dbUsers.hasDetails()]);
        if (probe !== null) hasUserDetails = probe;
        // null = request failed; [] = no accounts in the cloud. Either way keep
        // the seeded admins so the store can always be logged into.
        if (!rows || !rows.length) return;
        set({ users: rows.map(fromRow) });
      },

      addUser: (u) => {
        const newUser: AppUser = { ...u, id: `u-${Date.now()}` };
        set((s) => ({ users: [...s.users, newUser] }));
        dbUsers.upsert(toRow(newUser));
      },

      updateUser: (id, patch) => {
        const updated = get().users.map((x) => (x.id === id ? { ...x, ...patch } : x));
        set({ users: updated });
        const u = updated.find((x) => x.id === id);
        if (u) dbUsers.upsert(toRow(u));
      },

      deleteUser: (id) => {
        // Never allow protected admin accounts to be removed.
        if (PROTECTED_USER_IDS.has(id)) {
          console.warn(`[userStore] Cannot delete protected account: ${id}`);
          return;
        }
        set((s) => ({ users: s.users.filter((x) => x.id !== id) }));
        dbUsers.del(id);
      },

      toggleUser: (id) => {
        // Never allow protected admin accounts to be disabled.
        if (PROTECTED_USER_IDS.has(id)) {
          console.warn(`[userStore] Cannot disable protected account: ${id}`);
          return;
        }
        const updated = get().users.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x));
        set({ users: updated });
        const u = updated.find((x) => x.id === id);
        if (u) dbUsers.upsert(toRow(u));
      },

      authenticate: async (email, password) => {
        const e = email.trim().toLowerCase();
        const user = get().users.find((u) => u.enabled && u.email.toLowerCase() === e);
        if (!user || !(await verifyPassword(password, user.password))) return null;
        // Legacy plaintext record: upgrade it to a hash now that we know the password.
        if (!isHashed(user.password)) get().updateUser(user.id, { password: await hashPassword(password) });
        return user;
      },

      setCurrentUser: (id) => set({ currentUserId: id }),
      logout: () => set({ currentUserId: null, clockedInAt: null }),
      clockIn: () => set({ clockedInAt: Date.now() }),
      clockOut: () => set({ clockedInAt: null }),
    }),
    {
      name: 'nova-users-v3',
      // currentUserId is persisted so a page refresh keeps the cashier who
      // logged in, rather than silently reverting sales to the owner account.
      partialize: (s) => ({ users: s.users, clockedInAt: s.clockedInAt, currentUserId: s.currentUserId }),
    },
  ),
);
