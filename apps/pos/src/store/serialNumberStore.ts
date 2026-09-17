import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbSerialNumbers } from '../lib/db';

// Inventory → Serial numbers: one row per physical unit, so a product's
// movements and sales history can be traced by serial.

export type SerialStatus = 'In stock' | 'Sold' | 'Returned';

export interface SerialNumber {
  id: string;
  serial: string;
  productId: string;
  productName: string;
  outlet: string;
  status: SerialStatus;
  soldAt: number | null;
  saleOrderNumber: string;
  createdAt: number;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `sn-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

const toRow = (s: SerialNumber): Record<string, unknown> => ({
  id: s.id,
  serial: s.serial,
  product_id: s.productId,
  product_name: s.productName,
  outlet: s.outlet,
  status: s.status,
  sold_at: s.soldAt ? new Date(s.soldAt).toISOString() : null,
  sale_order_number: s.saleOrderNumber || null,
  created_at: new Date(s.createdAt).toISOString(),
});

const fromRow = (r: Record<string, unknown>): SerialNumber => ({
  id: r.id as string,
  serial: (r.serial as string) ?? '',
  productId: (r.product_id as string) ?? '',
  productName: (r.product_name as string) ?? '',
  outlet: (r.outlet as string) ?? '',
  status: ((r.status as string) || 'In stock') as SerialStatus,
  soldAt: r.sold_at ? new Date(r.sold_at as string).getTime() : null,
  saleOrderNumber: (r.sale_order_number as string | null) ?? '',
  createdAt: r.created_at ? new Date(r.created_at as string).getTime() : Date.now(),
});

interface SerialState {
  serials: SerialNumber[];
  syncFromDb: () => Promise<void>;
  /** Add one row per serial; serials already on file for the product are skipped. Returns how many were added. */
  addSerials: (productId: string, productName: string, outlet: string, serials: string[]) => number;
  updateSerial: (id: string, patch: Partial<SerialNumber>) => void;
  deleteSerial: (id: string) => void;
  /** Mark the serials of a sale's lines as sold (called when a sale completes). */
  markSold: (productId: string, serial: string, saleOrderNumber: string) => void;
}

export const useSerialNumbers = create<SerialState>()(
  persist(
    (set, get) => ({
      serials: [],
      syncFromDb: async () => {
        const rows = await dbSerialNumbers.list();
        if (rows === null || rows === 'missing') return;
        set({ serials: rows.map(fromRow) });
      },
      addSerials: (productId, productName, outlet, serials) => {
        const have = new Set(get().serials.filter((s) => s.productId === productId).map((s) => s.serial.toLowerCase()));
        const fresh = serials.map((s) => s.trim()).filter((s) => s && !have.has(s.toLowerCase()));
        const created = fresh.map((serial): SerialNumber => ({ id: uid(), serial, productId, productName, outlet, status: 'In stock', soldAt: null, saleOrderNumber: '', createdAt: Date.now() }));
        if (!created.length) return 0;
        set((s) => ({ serials: [...created, ...s.serials] }));
        created.forEach((c) => dbSerialNumbers.upsert(toRow(c)));
        return created.length;
      },
      updateSerial: (id, patch) => {
        const serials = get().serials.map((s) => (s.id === id ? { ...s, ...patch } : s));
        set({ serials });
        const s = serials.find((x) => x.id === id);
        if (s) dbSerialNumbers.upsert(toRow(s));
      },
      deleteSerial: (id) => {
        set((s) => ({ serials: s.serials.filter((x) => x.id !== id) }));
        dbSerialNumbers.del(id);
      },
      markSold: (productId, serial, saleOrderNumber) => {
        const hit = get().serials.find((s) => s.productId === productId && s.serial.toLowerCase() === serial.toLowerCase());
        if (hit) get().updateSerial(hit.id, { status: 'Sold', soldAt: Date.now(), saleOrderNumber });
      },
    }),
    { name: 'nova-serial-numbers-v1' },
  ),
);
