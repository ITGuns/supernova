import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Persisted inventory adjustment reasons, managed on the Catalog page.
export interface AdjustmentReason {
  id: string;
  name: string;
  type: string;
}

interface AdjustmentReasonsState {
  reasons: AdjustmentReason[];
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
      addReason: (name, type) =>
        set((s) => ({ reasons: [...s.reasons, { id: uid(), name, type }] })),
      deleteReason: (id) => set((s) => ({ reasons: s.reasons.filter((r) => r.id !== id) })),
    }),
    { name: 'nova-adjustment-reasons-v1' },
  ),
);
