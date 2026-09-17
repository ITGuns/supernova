import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbInventoryAdjustments } from '../lib/db';
import { useProducts } from './productStore';

// Manual stock adjustments (Catalog → product row → Adjust Inventory). Each
// one records why stock changed so the inventory movements view can explain
// every unit; the product's stock on hand changes at the same time.

export interface InventoryAdjustment {
  id: string;
  productId: string;
  productName: string;
  outlet: string;
  reasonId: string;
  reason: string;
  /** Signed: positive adds stock, negative removes it. */
  quantity: number;
  /** Supplier cost per unit at the time (for stock value reporting). */
  costMinor: number;
  note: string;
  user: string;
  createdAt: number;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `adj-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

const toRow = (a: InventoryAdjustment): Record<string, unknown> => ({
  id: a.id,
  product_id: a.productId,
  product_name: a.productName,
  outlet: a.outlet,
  reason_id: a.reasonId || null,
  reason: a.reason,
  quantity: a.quantity,
  cost_minor: a.costMinor,
  note: a.note,
  user: a.user,
  created_at: new Date(a.createdAt).toISOString(),
});

const fromRow = (r: Record<string, unknown>): InventoryAdjustment => ({
  id: r.id as string,
  productId: r.product_id as string,
  productName: (r.product_name as string) ?? '',
  outlet: (r.outlet as string) ?? '',
  reasonId: (r.reason_id as string | null) ?? '',
  reason: (r.reason as string) ?? '',
  quantity: Number(r.quantity ?? 0),
  costMinor: Number(r.cost_minor ?? 0),
  note: (r.note as string) ?? '',
  user: (r.user as string) ?? '',
  createdAt: r.created_at ? new Date(r.created_at as string).getTime() : Date.now(),
});

interface InventoryAdjustmentState {
  adjustments: InventoryAdjustment[];
  syncFromDb: () => Promise<void>;
  /** Record the adjustment and move the product's stock by the same amount. */
  addAdjustment: (a: Omit<InventoryAdjustment, 'id' | 'createdAt'>) => InventoryAdjustment;
}

export const useInventoryAdjustments = create<InventoryAdjustmentState>()(
  persist(
    (set) => ({
      adjustments: [],
      syncFromDb: async () => {
        const rows = await dbInventoryAdjustments.list();
        if (rows === null || rows === 'missing') return;
        set({ adjustments: rows.map(fromRow) });
      },
      addAdjustment: (a) => {
        const created: InventoryAdjustment = { ...a, id: uid(), createdAt: Date.now() };
        set((s) => ({ adjustments: [created, ...s.adjustments] }));
        dbInventoryAdjustments.upsert(toRow(created));
        useProducts.getState().adjustStock(a.productId, a.quantity);
        return created;
      },
    }),
    { name: 'nova-inventory-adjustments-v1' },
  ),
);
