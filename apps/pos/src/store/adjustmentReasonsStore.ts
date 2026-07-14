import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbAdjustmentReasons } from '../lib/db';

// Persisted inventory adjustment reasons, managed on the Catalog page.
export interface AdjustmentReason {
  id: string;
  name: string;
  type: string;
}

interface AdjustmentReasonsState {
  reasons: AdjustmentReason[];
  /** Pull reasons from Supabase. */
  syncFromDb: () => Promise<void>;
  addReason: (name: string, type: string) => void;
  deleteReason: (id: string) => void;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

export const useAdjustmentReasons = create<AdjustmentReasonsState>()(
  persist(
    (set) => ({
      reasons: [],

      syncFromDb: async () => {
        const rows = await dbAdjustmentReasons.list();
        if (!rows.length) return;
        set({
          reasons: rows.map((r) => ({
            id: r.id as string,
            name: r.name as string,
            type: r.kind as string,
          })),
        });
      },

      addReason: (name, type) => {
        const reason: AdjustmentReason = { id: uid(), name, type };
        set((s) => ({ reasons: [...s.reasons, reason] }));
        dbAdjustmentReasons.upsert({ id: reason.id, name: reason.name, kind: reason.type });
      },

      deleteReason: (id) => {
        set((s) => ({ reasons: s.reasons.filter((r) => r.id !== id) }));
        dbAdjustmentReasons.del(id);
      },
    }),
    { name: 'nova-adjustment-reasons-v1' },
  ),
);
