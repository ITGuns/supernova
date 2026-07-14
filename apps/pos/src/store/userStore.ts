import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbUsers } from '../lib/db';

// Single source of truth for staff/users, shared across Setup → Users,
// Reporting → User reports, the profile drawer, and login authentication.

// ── Protected accounts ───────────────────────────────────────────────────────
// These IDs can NEVER be deleted or disabled — they are seeded admin accounts.
const PROTECTED_USER_IDS = new Set(['u-owner', 'u-jade']);
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
}

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
});

const INIT: AppUser[] = [
  { id: 'u-owner', name: 'Alex Kim', email: 'alex@nova.local', role: 'Account owner, Admin', password: 'alex1234', enabled: true, owner: true, av: '#4b3df5', last: 'just now' },
  { id: 'u-jade', name: 'Jade Tatom', email: 'jade.tatom@nova.local', role: 'Admin', password: 'jade1234', enabled: true, av: '#7c3aed', last: 'just now' },
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
  authenticate: (email: string, password: string) => AppUser | null;
  setCurrentUser: (id: string) => void;
  clockIn: () => void;
  clockOut: () => void;
}

export const useUsers = create<UserState>()(
  persist(
    (set, get) => ({
      users: INIT,
      currentUserId: 'u-owner',
      clockedInAt: null,

      syncFromDb: async () => {
        const rows = await dbUsers.list();
        if (!rows.length) return;
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

      authenticate: (email, password) => {
        const e = email.trim().toLowerCase();
        return get().users.find((u) => u.enabled && u.email.toLowerCase() === e && u.password === password) ?? null;
      },

      setCurrentUser: (id) => set({ currentUserId: id }),
      clockIn: () => set({ clockedInAt: Date.now() }),
      clockOut: () => set({ clockedInAt: null }),
    }),
    {
      name: 'nova-users-v3',
      partialize: (s) => ({ users: s.users, clockedInAt: s.clockedInAt }),
    },
  ),
);
