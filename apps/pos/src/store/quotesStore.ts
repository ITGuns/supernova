import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  addQuote: (q: { customer: string; totalMinor: number }) => Quote;
  updateQuote: (id: string, patch: Partial<Quote>) => void;
  deleteQuote: (id: string) => void;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;

export const useQuotes = create<QuotesState>()(
  persist(
    (set, get) => ({
      quotes: [],
      quoteSeq: 1043,
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
        return created;
      },
      updateQuote: (id, patch) =>
        set((s) => ({ quotes: s.quotes.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      deleteQuote: (id) => set((s) => ({ quotes: s.quotes.filter((x) => x.id !== id) })),
    }),
    { name: 'nova-quotes-v1' },
  ),
);
