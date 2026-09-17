import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbFulfillments } from '../lib/db';
import type { CartLine } from './cartStore';

// Fulfillments (Inventory → Fulfillments): a sale marked as unfulfilled at
// the register — to be packed, picked up or delivered — that is retrieved
// back into the register when the customer collects and pays.

export type FulfillmentKind = 'pack' | 'pickup' | 'delivery';
export type FulfillmentStatus = 'Open' | 'Completed' | 'Cancelled';

export const FULFILLMENT_LABEL: Record<FulfillmentKind, string> = {
  pack: 'Pack order',
  pickup: 'Customer pickup',
  delivery: 'Delivery',
};

export interface Fulfillment {
  id: string;
  number: string;
  kind: FulfillmentKind;
  customerName: string;
  lines: CartLine[];
  discountBps: number;
  note: string;
  status: FulfillmentStatus;
  createdAt: number;
  completedAt: number | null;
}

interface FulfillmentState {
  fulfillments: Fulfillment[];
  seq: number;
  syncFromDb: () => Promise<void>;
  addFulfillment: (f: Omit<Fulfillment, 'id' | 'number' | 'createdAt' | 'status' | 'completedAt'>) => Fulfillment;
  updateFulfillment: (id: string, patch: Partial<Fulfillment>) => void;
  deleteFulfillment: (id: string) => void;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

let hasTable = true;

const toRow = (f: Fulfillment): Record<string, unknown> => ({
  id: f.id,
  number: f.number,
  kind: f.kind,
  customer_name: f.customerName,
  lines: f.lines,
  discount_bps: f.discountBps,
  note: f.note,
  status: f.status,
  created_at: new Date(f.createdAt).toISOString(),
  completed_at: f.completedAt ? new Date(f.completedAt).toISOString() : null,
});

const fromRow = (r: Record<string, unknown>): Fulfillment => ({
  id: r.id as string,
  number: r.number as string,
  kind: (r.kind as FulfillmentKind) ?? 'pickup',
  customerName: (r.customer_name as string | null) ?? '',
  lines: (r.lines as CartLine[] | null) ?? [],
  discountBps: (r.discount_bps as number | null) ?? 0,
  note: (r.note as string | null) ?? '',
  status: (r.status as FulfillmentStatus) ?? 'Open',
  createdAt: new Date(r.created_at as string).getTime(),
  completedAt: r.completed_at ? new Date(r.completed_at as string).getTime() : null,
});

const maxSeq = (list: Fulfillment[]): number =>
  list.reduce((max, f) => {
    const n = parseInt(f.number.replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) && n - 1000 > max ? n - 1000 : max;
  }, 0);

export const useFulfillments = create<FulfillmentState>()(
  persist(
    (set, get) => ({
      fulfillments: [],
      seq: 1,

      syncFromDb: async () => {
        const rows = await dbFulfillments.list();
        if (rows === null) return;
        if (rows === 'missing') {
          hasTable = false;
          return;
        }
        hasTable = true;
        const fulfillments = rows.map(fromRow);
        set((s) => ({ fulfillments, seq: Math.max(s.seq, maxSeq(fulfillments) + 1) }));
      },

      addFulfillment: (f) => {
        const seq = Math.max(get().seq, maxSeq(get().fulfillments) + 1);
        const created: Fulfillment = { ...f, id: uid(), number: `F-${1000 + seq}`, status: 'Open', createdAt: Date.now(), completedAt: null };
        set((s) => ({ fulfillments: [created, ...s.fulfillments], seq: seq + 1 }));
        if (hasTable) dbFulfillments.upsert(toRow(created));
        return created;
      },

      updateFulfillment: (id, patch) => {
        const fulfillments = get().fulfillments.map((f) => (f.id === id ? { ...f, ...patch } : f));
        set({ fulfillments });
        const f = fulfillments.find((x) => x.id === id);
        if (f && hasTable) dbFulfillments.upsert(toRow(f));
      },

      deleteFulfillment: (id) => {
        set((s) => ({ fulfillments: s.fulfillments.filter((f) => f.id !== id) }));
        if (hasTable) dbFulfillments.del(id);
      },
    }),
    { name: 'nova-fulfillments-v1' },
  ),
);
