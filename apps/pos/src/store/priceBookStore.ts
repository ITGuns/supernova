import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbPriceBooks } from '../lib/db';

// Price books (Catalog → Price books): a set of product prices for a
// customer group (and optionally an outlet / date range). At the register the
// customer's group decides which book applies.

export interface PriceBookEntry {
  productId: string;
  priceMinor: number;
  /** Optional quantity band the price applies to (e.g. 6+ units). */
  minUnits?: number | null;
  maxUnits?: number | null;
}

export interface PriceBook {
  id: string;
  name: string;
  /** 'All Customers' applies to everyone. */
  customerGroup: string;
  /** '' = all outlets. */
  outlet: string;
  startAt: number | null;
  endAt: number | null;
  entries: PriceBookEntry[];
  createdAt: number;
}

export const priceBookActive = (b: PriceBook, now = Date.now()): boolean =>
  (b.startAt === null || b.startAt <= now) && (b.endAt === null || b.endAt >= now);

/**
 * The price a product sells for to a customer in `group` (null = no
 * customer). A book for the customer's own group beats an "All Customers"
 * book; between books of the same kind the lowest price wins.
 */
export const priceBookPrice = (
  productId: string,
  group: string | null,
  books: PriceBook[],
  now = Date.now(),
): { book: PriceBook; priceMinor: number } | null => {
  const hits = (matchGroup: (g: string) => boolean) => {
    let best: { book: PriceBook; priceMinor: number } | null = null;
    for (const b of books) {
      if (!priceBookActive(b, now) || !matchGroup(b.customerGroup)) continue;
      const e = b.entries.find((x) => x.productId === productId);
      if (e && (!best || e.priceMinor < best.priceMinor)) best = { book: b, priceMinor: e.priceMinor };
    }
    return best;
  };
  return (group ? hits((g) => g === group && g !== 'All Customers') : null) ?? hits((g) => g === 'All Customers');
};

interface PriceBookState {
  priceBooks: PriceBook[];
  syncFromDb: () => Promise<void>;
  addPriceBook: (b: Omit<PriceBook, 'id' | 'createdAt'>) => PriceBook;
  updatePriceBook: (id: string, patch: Partial<PriceBook>) => void;
  deletePriceBook: (id: string) => void;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

let hasTable = true;

const toRow = (b: PriceBook): Record<string, unknown> => ({
  id: b.id,
  name: b.name,
  customer_group: b.customerGroup,
  outlet: b.outlet,
  start_at: b.startAt ? new Date(b.startAt).toISOString() : null,
  end_at: b.endAt ? new Date(b.endAt).toISOString() : null,
  entries: b.entries,
  created_at: new Date(b.createdAt).toISOString(),
});

const fromRow = (r: Record<string, unknown>): PriceBook => ({
  id: r.id as string,
  name: r.name as string,
  customerGroup: (r.customer_group as string | null) ?? 'All Customers',
  outlet: (r.outlet as string | null) ?? '',
  startAt: r.start_at ? new Date(r.start_at as string).getTime() : null,
  endAt: r.end_at ? new Date(r.end_at as string).getTime() : null,
  entries: (r.entries as PriceBookEntry[] | null) ?? [],
  createdAt: new Date(r.created_at as string).getTime(),
});

export const usePriceBooks = create<PriceBookState>()(
  persist(
    (set, get) => ({
      priceBooks: [],

      syncFromDb: async () => {
        const rows = await dbPriceBooks.list();
        if (rows === null) return;
        if (rows === 'missing') {
          hasTable = false;
          return;
        }
        hasTable = true;
        set({ priceBooks: rows.map(fromRow) });
      },

      addPriceBook: (b) => {
        const created: PriceBook = { ...b, id: uid(), createdAt: Date.now() };
        set((s) => ({ priceBooks: [created, ...s.priceBooks] }));
        if (hasTable) dbPriceBooks.upsert(toRow(created));
        return created;
      },

      updatePriceBook: (id, patch) => {
        const priceBooks = get().priceBooks.map((b) => (b.id === id ? { ...b, ...patch } : b));
        set({ priceBooks });
        const b = priceBooks.find((x) => x.id === id);
        if (b && hasTable) dbPriceBooks.upsert(toRow(b));
      },

      deletePriceBook: (id) => {
        set((s) => ({ priceBooks: s.priceBooks.filter((b) => b.id !== id) }));
        if (hasTable) dbPriceBooks.del(id);
      },
    }),
    { name: 'nova-price-books-v1' },
  ),
);
