import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbTimeEntries } from '../lib/db';

// Time cards: one row per clock-in, closed when the user clocks out. Feeds
// Reporting → User reports → Time cards.

export interface TimeEntry {
  id: string;
  userName: string;
  clockIn: number;
  clockOut: number | null;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `te-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

const toRow = (t: TimeEntry): Record<string, unknown> => ({
  id: t.id,
  user_name: t.userName,
  clock_in: new Date(t.clockIn).toISOString(),
  clock_out: t.clockOut ? new Date(t.clockOut).toISOString() : null,
});

const fromRow = (r: Record<string, unknown>): TimeEntry => ({
  id: r.id as string,
  userName: (r.user_name as string) ?? '',
  clockIn: new Date(r.clock_in as string).getTime(),
  clockOut: r.clock_out ? new Date(r.clock_out as string).getTime() : null,
});

/** Minutes worked on the entries (open entries count up to now). */
export const minutesWorked = (entries: TimeEntry[], now = Date.now()): number =>
  entries.reduce((a, t) => a + Math.max(0, Math.floor(((t.clockOut ?? now) - t.clockIn) / 60000)), 0);

export const fmtMinutes = (mins: number): string => (mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} hr${Math.floor(mins / 60) === 1 ? '' : 's'} ${mins % 60} min`);

interface TimeEntryState {
  entries: TimeEntry[];
  syncFromDb: () => Promise<void>;
  /** Start a time card for the user (closes any card they left open). */
  clockIn: (userName: string) => void;
  clockOut: (userName: string) => void;
  updateEntry: (id: string, patch: Partial<TimeEntry>) => void;
  deleteEntry: (id: string) => void;
}

export const useTimeEntries = create<TimeEntryState>()(
  persist(
    (set, get) => ({
      entries: [],
      syncFromDb: async () => {
        const rows = await dbTimeEntries.list();
        if (rows === null || rows === 'missing') return;
        set({ entries: rows.map(fromRow) });
      },
      clockIn: (userName) => {
        get().clockOut(userName);
        const created: TimeEntry = { id: uid(), userName, clockIn: Date.now(), clockOut: null };
        set((s) => ({ entries: [created, ...s.entries] }));
        dbTimeEntries.upsert(toRow(created));
      },
      clockOut: (userName) => {
        const open = get().entries.filter((t) => t.userName === userName && t.clockOut === null);
        if (!open.length) return;
        const now = Date.now();
        const entries = get().entries.map((t) => (t.userName === userName && t.clockOut === null ? { ...t, clockOut: now } : t));
        set({ entries });
        open.forEach((t) => dbTimeEntries.upsert(toRow({ ...t, clockOut: now })));
      },
      updateEntry: (id, patch) => {
        const entries = get().entries.map((t) => (t.id === id ? { ...t, ...patch } : t));
        set({ entries });
        const t = entries.find((x) => x.id === id);
        if (t) dbTimeEntries.upsert(toRow(t));
      },
      deleteEntry: (id) => {
        set((s) => ({ entries: s.entries.filter((t) => t.id !== id) }));
        dbTimeEntries.del(id);
      },
    }),
    { name: 'nova-time-entries-v1' },
  ),
);
