import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Single source of truth for staff/users, shared across Setup → Users,
// Reporting → User reports, the profile drawer, and login authentication.
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
}

export const initials = (n: string) =>
  n
    .split(' ')
    .map((s) => s.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

const INIT: AppUser[] = [
  { id: 'u-owner', name: 'Alex Kim', email: 'alex@nova.local', role: 'Account owner, Admin', password: 'alex1234', enabled: true, owner: true, av: '#4b3df5', last: 'just now' },
  { id: 'u-jade', name: 'Jade Tatom', email: 'jade.tatom@nova.local', role: 'Admin', password: 'jade1234', enabled: true, av: '#7c3aed', last: 'just now' },
];

interface UserState {
  users: AppUser[];
  currentUserId: string | null;
  addUser: (u: Omit<AppUser, 'id'>) => void;
  updateUser: (id: string, patch: Partial<AppUser>) => void;
  deleteUser: (id: string) => void;
  toggleUser: (id: string) => void;
  authenticate: (email: string, password: string) => AppUser | null;
  setCurrentUser: (id: string) => void;
}

export const useUsers = create<UserState>()(
  persist(
    (set, get) => ({
      users: INIT,
      currentUserId: 'u-owner',
      addUser: (u) => set((s) => ({ users: [...s.users, { ...u, id: `u-${Date.now()}` }] })),
      updateUser: (id, patch) => set((s) => ({ users: s.users.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      deleteUser: (id) => set((s) => ({ users: s.users.filter((x) => x.id !== id) })),
      toggleUser: (id) => set((s) => ({ users: s.users.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x)) })),
      authenticate: (email, password) => {
        const e = email.trim().toLowerCase();
        return get().users.find((u) => u.enabled && u.email.toLowerCase() === e && u.password === password) ?? null;
      },
      setCurrentUser: (id) => set({ currentUserId: id }),
    }),
    {
      name: 'nova-users-v3',
      partialize: (s) => ({ users: s.users }), // persist accounts, not the active session
    },
  ),
);
