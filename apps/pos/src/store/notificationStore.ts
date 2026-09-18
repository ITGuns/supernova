import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// In-app notifications (bell in the top bar): business-rule emails to the
// account owner, low-stock alerts and other things the store wants you to see.

export interface Notification {
  id: string;
  title: string;
  text: string;
  at: number;
  read: boolean;
  /** Where clicking the notification goes, e.g. /inventory. */
  to?: string;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `n-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

interface NotificationState {
  items: Notification[];
  notify: (title: string, text: string, to?: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useNotifications = create<NotificationState>()(
  persist(
    (set) => ({
      items: [],
      notify: (title, text, to) => set((s) => ({ items: [{ id: uid(), title, text, at: Date.now(), read: false, to }, ...s.items].slice(0, 100) })),
      markAllRead: () => set((s) => ({ items: s.items.map((n) => ({ ...n, read: true })) })),
      dismiss: (id) => set((s) => ({ items: s.items.filter((n) => n.id !== id) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'nova-notifications-v1' },
  ),
);
