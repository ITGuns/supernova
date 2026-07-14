import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

export const useInventory = create<InventoryState>()(
  persist(
    (set, get) => ({
      transactions: [],
      counts: [],
      txSeq: 1,
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
        return created;
      },
      updateTransaction: (id, patch) =>
        set((s) => ({
          transactions: s.transactions.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        })),
      deleteTransaction: (id) =>
        set((s) => ({ transactions: s.transactions.filter((x) => x.id !== id) })),
      receiveTransaction: (id) => {
        const tx = get().transactions.find((t) => t.id === id);
        if (!tx || tx.status === 'Received') return;
        const prodStore = useProducts.getState();
        for (const line of tx.lines) {
          const prod = prodStore.products.find((p) => p.id === line.productId);
          if (prod) prodStore.updateProduct(prod.id, { available: prod.available + line.quantity });
        }
        set((s) => ({
          transactions: s.transactions.map((x) =>
            x.id === id ? { ...x, status: 'Received' as StockTxStatus } : x,
          ),
        }));
      },
      addCount: (c) =>
        set((s) => ({ counts: [{ ...c, id: uid(), createdAt: Date.now() }, ...s.counts] })),
      updateCount: (id, patch) =>
        set((s) => ({ counts: s.counts.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
    }),
    { name: 'nova-inventory-v1' },
  ),
);
