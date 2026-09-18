import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Reporting → Shared reports: reports a user has shared with colleagues (by
// email). Kept on this device; sharing sends a link to the report.

export interface SharedReport {
  id: string;
  report: string;
  owner: string;
  recipients: string[];
  createdAt: number;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `sr-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

interface SharedReportState {
  shared: SharedReport[];
  share: (report: string, owner: string, recipients: string[]) => void;
  unshare: (id: string) => void;
}

export const useSharedReports = create<SharedReportState>()(
  persist(
    (set) => ({
      shared: [],
      share: (report, owner, recipients) => set((s) => ({ shared: [{ id: uid(), report, owner, recipients, createdAt: Date.now() }, ...s.shared] })),
      unshare: (id) => set((s) => ({ shared: s.shared.filter((r) => r.id !== id) })),
    }),
    { name: 'nova-shared-reports-v1' },
  ),
);
