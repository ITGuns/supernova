import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbStockTx, dbInventoryCounts } from '../lib/db';
import { useProducts } from './productStore';

// Persisted stock transactions (purchase orders, transfers, returns) and
// inventory counts. Receiving stock writes back to productStore.available.
export type StockTxKind = 'order' | 'transfer' | 'return';
export type StockTxStatus = 'Draft' | 'Open' | 'Sent' | 'Dispatched' | 'Received' | 'Cancelled';

export interface StockTxLine {
  productId: string;
  name: string;
  quantity: number;
}

export interface StockTx {
  id: string;
  kind: StockTxKind;
  number: string;
  from: string;
  to: string;
  status: StockTxStatus;
  createdAt: number;
  dueAt: number | null;
  lines: StockTxLine[];
}

export interface InventoryCount {
  id: string;
  name: string;
  outlet: string;
  status: 'In progress' | 'Completed' | 'Cancelled';
  createdAt: number;
}

interface InventoryState {
  transactions: StockTx[];
  counts: InventoryCount[];
  txSeq: number;
  /** Pull transactions + counts from Supabase. */
  syncFromDb: () => Promise<void>;
  addTransaction: (t: Omit<StockTx, 'id' | 'number' | 'createdAt'>) => StockTx;
  updateTransaction: (id: string, patch: Partial<StockTx>) => void;
  deleteTransaction: (id: string) => void;
  /** Mark a transaction received and add its line quantities to product stock. */
  receiveTransaction: (id: string) => void;
  addCount: (c: Omit<InventoryCount, 'id' | 'createdAt'>) => void;
  updateCount: (id: string, patch: Partial<InventoryCount>) => void;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

// snake_case mappers
const txToRow = (t: StockTx): Record<string, unknown> => ({
  id: t.id,
  kind: t.kind,
  number: t.number,
  from: t.from,
  to: t.to,
  status: t.status,
  created_at: new Date(t.createdAt).toISOString(),
  due_at: t.dueAt ? new Date(t.dueAt).toISOString() : null,
  lines: t.lines,
});

const rowToTx = (r: Record<string, unknown>): StockTx => ({
  id: r.id as string,
  kind: r.kind as StockTxKind,
  number: r.number as string,
  from: r.from as string,
  to: r.to as string,
  status: r.status as StockTxStatus,
  createdAt: new Date(r.created_at as string).getTime(),
  dueAt: r.due_at ? new Date(r.due_at as string).getTime() : null,
  lines: r.lines as StockTxLine[],
});

const countToRow = (c: InventoryCount): Record<string, unknown> => ({
  id: c.id,
  name: c.name,
  outlet: c.outlet,
  status: c.status,
  created_at: new Date(c.createdAt).toISOString(),
});

const rowToCount = (r: Record<string, unknown>): InventoryCount => ({
  id: r.id as string,
  name: r.name as string,
  outlet: r.outlet as string,
  status: r.status as InventoryCount['status'],
  createdAt: new Date(r.created_at as string).getTime(),
});

export const useInventory = create<InventoryState>()(
  persist(
    (set, get) => ({
      transactions: [],
      counts: [],
      txSeq: 1,

      syncFromDb: async () => {
        const [txRows, countRows] = await Promise.all([
          dbStockTx.list(),
          dbInventoryCounts.list(),
        ]);
        if (txRows.length || countRows.length) {
          set({
            transactions: txRows.map(rowToTx),
            counts: countRows.map(rowToCount),
          });
        }
      },

      addTransaction: (t) => {
        const seq = get().txSeq;
        const prefix = t.kind === 'order' ? 'PO' : t.kind === 'transfer' ? 'TR' : 'RT';
        const created: StockTx = {
          ...t,
          id: uid(),
          number: `${prefix}-${1000 + seq}`,
          createdAt: Date.now(),
        };
        set((s) => ({ transactions: [created, ...s.transactions], txSeq: s.txSeq + 1 }));
        dbStockTx.upsert(txToRow(created));
        return created;
      },

      updateTransaction: (id, patch) => {
        const transactions = get().transactions.map((x) => (x.id === id ? { ...x, ...patch } : x));
        set({ transactions });
        const t = transactions.find((x) => x.id === id);
        if (t) dbStockTx.upsert(txToRow(t));
      },

      deleteTransaction: (id) => {
        set((s) => ({ transactions: s.transactions.filter((x) => x.id !== id) }));
        dbStockTx.del(id);
      },

      receiveTransaction: (id) => {
        const tx = get().transactions.find((t) => t.id === id);
        if (!tx || tx.status === 'Received') return;
        const prodStore = useProducts.getState();
        for (const line of tx.lines) {
          const prod = prodStore.products.find((p) => p.id === line.productId);
          if (prod) prodStore.updateProduct(prod.id, { available: prod.available + line.quantity });
        }
        const transactions = get().transactions.map((x) =>
          x.id === id ? { ...x, status: 'Received' as StockTxStatus } : x,
        );
        set({ transactions });
        const t = transactions.find((x) => x.id === id);
        if (t) dbStockTx.upsert(txToRow(t));
      },

      addCount: (c) => {
        const created: InventoryCount = { ...c, id: uid(), createdAt: Date.now() };
        set((s) => ({ counts: [created, ...s.counts] }));
        dbInventoryCounts.upsert(countToRow(created));
      },

      updateCount: (id, patch) => {
        const counts = get().counts.map((x) => (x.id === id ? { ...x, ...patch } : x));
        set({ counts });
        const c = counts.find((x) => x.id === id);
        if (c) dbInventoryCounts.upsert(countToRow(c));
      },
    }),
    { name: 'nova-inventory-v1' },
  ),
);
