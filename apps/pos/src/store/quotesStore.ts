import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbQuotes } from '../lib/db';

// Persisted quotes for Sell → Quotes.
export type QuoteStatus = 'Draft' | 'Sent' | 'Accepted' | 'Declined' | 'Expired';

export interface Quote {
  id: string;
  num: string;
  customer: string;
  totalMinor: number;
  createdAt: number;
  expiresAt: number;
  status: QuoteStatus;
}

interface QuotesState {
  quotes: Quote[];
  quoteSeq: number;
  /** Pull quotes from Supabase. */
  syncFromDb: () => Promise<void>;
  addQuote: (q: { customer: string; totalMinor: number }) => Quote;
  updateQuote: (id: string, patch: Partial<Quote>) => void;
  deleteQuote: (id: string) => void;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;

const toRow = (q: Quote): Record<string, unknown> => ({
  id: q.id,
  num: q.num,
  customer: q.customer,
  total_minor: q.totalMinor,
  created_at: new Date(q.createdAt).toISOString(),
  expires_at: new Date(q.expiresAt).toISOString(),
  status: q.status,
});

const fromRow = (r: Record<string, unknown>): Quote => ({
  id: r.id as string,
  num: r.num as string,
  customer: r.customer as string,
  totalMinor: r.total_minor as number,
  createdAt: new Date(r.created_at as string).getTime(),
  expiresAt: new Date(r.expires_at as string).getTime(),
  status: r.status as QuoteStatus,
});

export const useQuotes = create<QuotesState>()(
  persist(
    (set, get) => ({
      quotes: [],
      quoteSeq: 1043,

      syncFromDb: async () => {
        const rows = await dbQuotes.list();
        if (!rows.length) return;
        set({ quotes: rows.map(fromRow) });
      },

      addQuote: (q) => {
        const seq = get().quoteSeq;
        const created: Quote = {
          id: uid(),
          num: `Q-${seq}`,
          customer: q.customer,
          totalMinor: q.totalMinor,
          createdAt: Date.now(),
          expiresAt: Date.now() + FOURTEEN_DAYS,
          status: 'Draft',
        };
        set((s) => ({ quotes: [created, ...s.quotes], quoteSeq: s.quoteSeq + 1 }));
        dbQuotes.upsert(toRow(created));
        return created;
      },

      updateQuote: (id, patch) => {
        const quotes = get().quotes.map((x) => (x.id === id ? { ...x, ...patch } : x));
        set({ quotes });
        const q = quotes.find((x) => x.id === id);
        if (q) dbQuotes.upsert(toRow(q));
      },

      deleteQuote: (id) => {
        set((s) => ({ quotes: s.quotes.filter((x) => x.id !== id) }));
        dbQuotes.del(id);
      },
    }),
    { name: 'nova-quotes-v1' },
  ),
);
