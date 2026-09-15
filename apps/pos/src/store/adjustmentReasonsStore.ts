import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbAdjustmentReasons } from '../lib/db';

// Persisted inventory adjustment reasons, managed on Catalog → Adjustment
// reasons. Each reason either adds stock (Positive) or removes it (Negative)
// and can be disabled without being deleted.

export type AdjustmentType = 'Positive' | 'Negative';

export interface AdjustmentReason {
  id: string;
  name: string;
  type: AdjustmentType;
  enabled: boolean;
}

interface AdjustmentReasonsState {
  reasons: AdjustmentReason[];
  /** Pull reasons from Supabase. */
  syncFromDb: () => Promise<void>;
  addReason: (name: string, type: AdjustmentType) => AdjustmentReason;
  updateReason: (id: string, patch: Partial<Omit<AdjustmentReason, 'id'>>) => void;
  deleteReason: (id: string) => void;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

/** Rows written before 0007 stored "Increase stock" / "Decrease stock" / "loss". */
const typeOf = (kind: unknown): AdjustmentType =>
  typeof kind === 'string' && /positive|increase|gain|found/i.test(kind) ? 'Positive' : 'Negative';

// Whether the cloud table has the `enabled` column (migration 0007).
let hasEnabledColumn = true;

const toRow = (r: AdjustmentReason): Record<string, unknown> => ({
  id: r.id,
  name: r.name,
  kind: r.type,
  ...(hasEnabledColumn ? { enabled: r.enabled } : {}),
});

export const useAdjustmentReasons = create<AdjustmentReasonsState>()(
  persist(
    (set, get) => ({
      reasons: [],

      syncFromDb: async () => {
        const rows = await dbAdjustmentReasons.list();
        if (!rows) return; // request failed — keep cached reasons
        const probe = await dbAdjustmentReasons.hasEnabled();
        if (probe !== null) hasEnabledColumn = probe;
        set({
          reasons: rows.map((r) => ({
            id: r.id as string,
            name: r.name as string,
            type: typeOf(r.kind),
            enabled: r.enabled !== false,
          })),
        });
      },

      addReason: (name, type) => {
        const reason: AdjustmentReason = { id: uid(), name: name.trim(), type, enabled: true };
        set((s) => ({ reasons: [...s.reasons, reason] }));
        dbAdjustmentReasons.upsert(toRow(reason));
        return reason;
      },

      updateReason: (id, patch) => {
        const reasons = get().reasons.map((r) => (r.id === id ? { ...r, ...patch } : r));
        set({ reasons });
        const reason = reasons.find((r) => r.id === id);
        if (reason) dbAdjustmentReasons.upsert(toRow(reason));
      },

      deleteReason: (id) => {
        set((s) => ({ reasons: s.reasons.filter((r) => r.id !== id) }));
        dbAdjustmentReasons.del(id);
      },
    }),
    { name: 'nova-adjustment-reasons-v1' },
  ),
);
