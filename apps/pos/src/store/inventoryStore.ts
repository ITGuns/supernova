import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbStockTx, dbInventoryCounts } from '../lib/db';
import { categoryDescendantIds, type MetaEntity } from './catalogMetaStore';
import { useProducts, type Product } from './productStore';

// Persisted stock transactions (purchase orders / stock receipts, transfers,
// returns) and inventory counts. Receiving stock and completing a count write
// back to productStore.available.

// ── Stock transactions ───────────────────────────────────────────────────────

export type StockTxKind = 'order' | 'transfer' | 'return';
export type StockTxStatus = 'Draft' | 'Open' | 'Sent' | 'Dispatched' | 'Received' | 'Cancelled';

export interface StockTxLine {
  productId: string;
  name: string;
  sku?: string;
  /** Ordered quantity. */
  quantity: number;
  /** Quantity actually received; defaults to the ordered quantity. */
  received?: number;
  /** Supply price per unit, in minor units. */
  costMinor?: number;
}

/** How a shipping / import-duty amount is spread over the items. */
export type ApplyMode = 'none' | 'quantity' | 'cost';

export interface StockTxDetails {
  supplierInvoice: string;
  /** Purchase orders: the outlet the order is placed for (defaults to the delivery outlet). */
  orderingFor?: string;
  /** ISO date (yyyy-mm-dd) or ''. */
  deliveryDate: string;
  invoiceDate: string;
  note: string;
  discountMode: 'pct' | 'amount';
  /** Percent (10 = 10%) or minor units, per discountMode. */
  discountValue: number;
  shippingMinor: number;
  shippingApply: ApplyMode;
  dutyMinor: number;
  dutyApply: ApplyMode;
  receivedAt: number | null;
}

export const EMPTY_TX_DETAILS: StockTxDetails = {
  supplierInvoice: '',
  deliveryDate: '',
  invoiceDate: '',
  note: '',
  discountMode: 'pct',
  discountValue: 0,
  shippingMinor: 0,
  shippingApply: 'none',
  dutyMinor: 0,
  dutyApply: 'none',
  receivedAt: null,
};

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
  details: StockTxDetails;
}

/** Units on a line: what was received once the transaction is received, else what was ordered. */
export const lineQty = (l: StockTxLine, status: StockTxStatus): number =>
  status === 'Received' ? (l.received ?? l.quantity) : l.quantity;

export const txQty = (t: StockTx): number => t.lines.reduce((s, l) => s + lineQty(l, t.status), 0);
export const txSubtotal = (t: StockTx): number =>
  t.lines.reduce((s, l) => s + lineQty(l, t.status) * (l.costMinor ?? 0), 0);
export const txDiscount = (t: StockTx): number => {
  const sub = txSubtotal(t);
  const d = t.details;
  return d.discountMode === 'pct'
    ? Math.round((sub * Math.min(100, Math.max(0, d.discountValue))) / 100)
    : Math.min(sub, Math.max(0, Math.round(d.discountValue)));
};
export const txTotal = (t: StockTx): number =>
  txSubtotal(t) - txDiscount(t) + Math.max(0, t.details.shippingMinor) + Math.max(0, t.details.dutyMinor);

export const TX_PREFIX: Record<StockTxKind, string> = { order: 'PO', transfer: 'TR', return: 'RT' };

// ── Inventory counts ─────────────────────────────────────────────────────────

export type CountStatus = 'Planned' | 'In progress' | 'Completed' | 'Cancelled';
export type CountType = 'full' | 'partial';
export type CountFilterKind = 'supplier' | 'brand' | 'category' | 'tag' | 'sku';

export interface CountFilter {
  kind: CountFilterKind;
  /** Category id, or the supplier / brand / tag / SKU text. */
  value: string;
  /** What to show on the chip (a category's full path). */
  label: string;
}

export interface CountLine {
  productId: string;
  name: string;
  sku: string;
  /** Stock on hand when the count started. */
  expected: number;
  /** null until someone enters a quantity. */
  counted: number | null;
}

export interface InventoryCount {
  id: string;
  name: string;
  outlet: string;
  status: CountStatus;
  createdAt: number;
  /** When the count is scheduled to start. */
  startAt: number;
  countType: CountType;
  includeInactive: boolean;
  filters: CountFilter[];
  lines: CountLine[];
  completedAt: number | null;
}

/** Whether a product is part of a count, given its type, filters and the inactive toggle. */
export const productInCount = (
  p: Product,
  c: Pick<InventoryCount, 'countType' | 'includeInactive' | 'filters'>,
  categories: MetaEntity[],
): boolean => {
  if (!c.includeInactive && !p.enabled) return false;
  if (c.countType === 'full') return true;
  if (!c.filters.length) return false;
  const eq = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  return c.filters.some((f) => {
    switch (f.kind) {
      case 'supplier':
        return eq(p.supplier, f.value) || (p.suppliers ?? []).some((s) => eq(s.supplier, f.value));
      case 'brand':
        return eq(p.brand, f.value);
      case 'category':
        return categoryDescendantIds(categories, f.value).has(p.categoryId);
      case 'tag':
        return (p.tags ?? []).some((t) => eq(t, f.value));
      case 'sku':
        return eq(p.sku, f.value) || (p.skuCodes ?? []).some((s) => eq(s.code, f.value));
      default:
        return false;
    }
  });
};

/** Snapshot the products a count covers into countable lines. */
export const countLinesFor = (products: Product[], c: Pick<InventoryCount, 'countType' | 'includeInactive' | 'filters'>, categories: MetaEntity[]): CountLine[] =>
  products
    .filter((p) => productInCount(p, c, categories))
    .map((p) => ({ productId: p.id, name: p.name, sku: p.sku, expected: p.available, counted: null }));

/** Lightspeed's tabs: a planned count is "due" once its start time has passed. */
export const countBucket = (c: InventoryCount, now = Date.now()): 'due' | 'upcoming' | 'completed' | 'canceled' =>
  c.status === 'Completed'
    ? 'completed'
    : c.status === 'Cancelled'
    ? 'canceled'
    : c.status === 'In progress' || c.startAt <= now
    ? 'due'
    : 'upcoming';

// ── Store ────────────────────────────────────────────────────────────────────

interface InventoryState {
  transactions: StockTx[];
  counts: InventoryCount[];
  txSeq: number;
  /** Pull transactions + counts from Supabase. */
  syncFromDb: () => Promise<void>;
  /** Next free number for a kind, e.g. "PO-1004". */
  nextNumber: (kind: StockTxKind) => string;
  addTransaction: (t: Omit<StockTx, 'id' | 'createdAt' | 'number'> & { number?: string }) => StockTx;
  updateTransaction: (id: string, patch: Partial<StockTx>) => void;
  deleteTransaction: (id: string) => void;
  /** Mark an order / transfer received and add the received quantities to stock on hand. */
  receiveTransaction: (id: string) => void;
  /** Send a return to the supplier: removes its quantities from stock on hand. */
  sendReturn: (id: string) => void;
  addCount: (c: Omit<InventoryCount, 'id' | 'createdAt'>) => InventoryCount;
  updateCount: (id: string, patch: Partial<InventoryCount>) => void;
  deleteCount: (id: string) => void;
  /** Begin counting: snapshots the products it covers with their current stock. */
  startCount: (id: string, lines: CountLine[]) => void;
  /** Finish a count: stock on hand becomes the counted quantity for every counted line. */
  completeCount: (id: string) => void;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

// Whether the cloud tables have the `details` columns (migration 0007).
let hasTxDetails = true;
let hasCountDetails = true;

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
  ...(hasTxDetails ? { details: t.details } : {}),
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
  lines: (r.lines as StockTxLine[] | null) ?? [],
  details: { ...EMPTY_TX_DETAILS, ...((r.details as Partial<StockTxDetails> | null) ?? {}) },
});

const countToRow = (c: InventoryCount): Record<string, unknown> => ({
  id: c.id,
  name: c.name,
  outlet: c.outlet,
  status: c.status,
  created_at: new Date(c.createdAt).toISOString(),
  ...(hasCountDetails
    ? {
        details: {
          startAt: c.startAt,
          countType: c.countType,
          includeInactive: c.includeInactive,
          filters: c.filters,
          lines: c.lines,
          completedAt: c.completedAt,
        },
      }
    : {}),
});

const rowToCount = (r: Record<string, unknown>): InventoryCount => {
  const d = (r.details as Partial<InventoryCount> | null) ?? {};
  const createdAt = new Date(r.created_at as string).getTime();
  return {
    id: r.id as string,
    name: r.name as string,
    outlet: r.outlet as string,
    status: r.status as CountStatus,
    createdAt,
    startAt: typeof d.startAt === 'number' ? d.startAt : createdAt,
    countType: d.countType === 'partial' ? 'partial' : 'full',
    includeInactive: d.includeInactive === true,
    filters: d.filters ?? [],
    lines: d.lines ?? [],
    completedAt: typeof d.completedAt === 'number' ? d.completedAt : null,
  };
};

/** Highest sequence number already used by any PO-/TR-/RT- number. */
const maxSeq = (transactions: StockTx[]): number =>
  transactions.reduce((max, t) => {
    const m = /^(?:PO|TR|RT)-(\d+)$/i.exec(t.number.trim());
    const n = m ? parseInt(m[1] ?? '0', 10) - 1000 : 0;
    return n > max ? n : max;
  }, 0);

export const useInventory = create<InventoryState>()(
  persist(
    (set, get) => ({
      transactions: [],
      counts: [],
      txSeq: 1,

      syncFromDb: async () => {
        const [txRows, countRows, txProbe, countProbe] = await Promise.all([
          dbStockTx.list(),
          dbInventoryCounts.list(),
          dbStockTx.hasDetails(),
          dbInventoryCounts.hasDetails(),
        ]);
        if (txProbe !== null) hasTxDetails = txProbe;
        if (countProbe !== null) hasCountDetails = countProbe;
        if (txRows && countRows) {
          const transactions = txRows.map(rowToTx);
          set({
            transactions,
            counts: countRows.map(rowToCount),
            // Numbers must stay unique across devices: continue from the cloud's highest.
            txSeq: Math.max(get().txSeq, maxSeq(transactions) + 1),
          });
        }
      },

      nextNumber: (kind) => `${TX_PREFIX[kind]}-${1000 + Math.max(get().txSeq, maxSeq(get().transactions) + 1)}`,

      addTransaction: (t) => {
        const number = t.number?.trim() || get().nextNumber(t.kind);
        const created: StockTx = {
          ...t,
          number,
          id: uid(),
          createdAt: Date.now(),
          details: { ...EMPTY_TX_DETAILS, ...t.details },
        };
        set((s) => ({
          transactions: [created, ...s.transactions],
          txSeq: Math.max(s.txSeq, maxSeq([created]) + 1),
        }));
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
        if (!tx || tx.status === 'Received' || tx.kind === 'return') return;
        // Stock on hand is store-wide, so a transfer between outlets moves
        // nothing in the total; an order adds what was received.
        if (tx.kind === 'order') {
          const prodStore = useProducts.getState();
          for (const line of tx.lines) {
            const qty = line.received ?? line.quantity;
            if (qty > 0 && prodStore.products.some((p) => p.id === line.productId)) prodStore.adjustStock(line.productId, qty);
          }
        }
        get().updateTransaction(id, {
          status: 'Received',
          lines: tx.lines.map((l) => ({ ...l, received: l.received ?? l.quantity })),
          details: { ...tx.details, receivedAt: Date.now() },
        });
      },

      sendReturn: (id) => {
        const tx = get().transactions.find((t) => t.id === id);
        if (!tx || tx.kind !== 'return' || tx.status === 'Sent') return;
        const prodStore = useProducts.getState();
        for (const line of tx.lines) {
          if (line.quantity > 0 && prodStore.products.some((p) => p.id === line.productId)) prodStore.adjustStock(line.productId, -line.quantity);
        }
        get().updateTransaction(id, { status: 'Sent' });
      },

      addCount: (c) => {
        const created: InventoryCount = { ...c, id: uid(), createdAt: Date.now() };
        set((s) => ({ counts: [created, ...s.counts] }));
        dbInventoryCounts.upsert(countToRow(created));
        return created;
      },

      updateCount: (id, patch) => {
        const counts = get().counts.map((x) => (x.id === id ? { ...x, ...patch } : x));
        set({ counts });
        const c = counts.find((x) => x.id === id);
        if (c) dbInventoryCounts.upsert(countToRow(c));
      },

      deleteCount: (id) => {
        set((s) => ({ counts: s.counts.filter((x) => x.id !== id) }));
        dbInventoryCounts.del(id);
      },

      startCount: (id, lines) => {
        const c = get().counts.find((x) => x.id === id);
        if (!c || c.status !== 'Planned') return;
        get().updateCount(id, { status: 'In progress', lines, startAt: Math.min(c.startAt, Date.now()) });
      },

      completeCount: (id) => {
        const c = get().counts.find((x) => x.id === id);
        if (!c || c.status !== 'In progress') return;
        const prodStore = useProducts.getState();
        for (const line of c.lines) {
          if (line.counted === null) continue; // uncounted products keep their stock on hand
          const p = prodStore.products.find((x) => x.id === line.productId);
          if (p && p.available !== line.counted) prodStore.updateProduct(p.id, { available: Math.max(0, line.counted) });
        }
        get().updateCount(id, { status: 'Completed', completedAt: Date.now() });
      },
    }),
    { name: 'nova-inventory-v1' },
  ),
);
