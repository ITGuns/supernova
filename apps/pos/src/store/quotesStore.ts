import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbQuotes } from '../lib/db';
import type { CartLine } from './cartStore';

// Persisted quotes for Sell → Quotes.
// Open: waiting on the customer. Completed: converted to a sale. Archived: closed without a sale.
export type QuoteStatus = 'Open' | 'Completed' | 'Archived';

/** Statuses written by earlier versions map onto the three Lightspeed ones. */
const normaliseStatus = (s: unknown): QuoteStatus =>
  s === 'Completed' || s === 'Accepted' ? 'Completed' : s === 'Archived' || s === 'Declined' || s === 'Expired' ? 'Archived' : 'Open';

export interface Quote {
  id: string;
  num: string;
  customer: string;
  totalMinor: number;
  createdAt: number;
  expiresAt: number;
  status: QuoteStatus;
  /** The quoted items, so the quote can be loaded back into the register. */
  lines: CartLine[];
  discountBps: number;
  note: string;
}

interface QuotesState {
  quotes: Quote[];
  quoteSeq: number;
  /** Pull quotes from Supabase. */
  syncFromDb: () => Promise<void>;
  addQuote: (q: { customer: string; totalMinor: number; lines?: CartLine[]; discountBps?: number; note?: string }) => Quote;
  updateQuote: (id: string, patch: Partial<Quote>) => void;
  deleteQuote: (id: string) => void;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;

// Whether the cloud table keeps quote lines (migration 0008) / a note (0009).
let hasLinesColumn = true;
let hasNoteColumn = true;

const toRow = (q: Quote): Record<string, unknown> => ({
  id: q.id,
  num: q.num,
  customer: q.customer,
  total_minor: q.totalMinor,
  created_at: new Date(q.createdAt).toISOString(),
  expires_at: new Date(q.expiresAt).toISOString(),
  status: q.status,
  ...(hasLinesColumn ? { lines: q.lines, discount_bps: q.discountBps } : {}),
  ...(hasNoteColumn ? { note: q.note } : {}),
});

const fromRow = (r: Record<string, unknown>): Quote => ({
  id: r.id as string,
  num: r.num as string,
  customer: r.customer as string,
  totalMinor: r.total_minor as number,
  createdAt: new Date(r.created_at as string).getTime(),
  expiresAt: new Date(r.expires_at as string).getTime(),
  status: normaliseStatus(r.status),
  lines: (r.lines as CartLine[] | null) ?? [],
  discountBps: (r.discount_bps as number | null) ?? 0,
  note: (r.note as string | null) ?? '',
});

export const useQuotes = create<QuotesState>()(
  persist(
    (set, get) => ({
      quotes: [],
      quoteSeq: 1043,

      syncFromDb: async () => {
        const rows = await dbQuotes.list();
        if (!rows) return; // request failed — keep cached quotes
        const [probe, noteProbe] = await Promise.all([dbQuotes.hasLines(), dbQuotes.hasNote()]);
        if (probe !== null) hasLinesColumn = probe;
        if (noteProbe !== null) hasNoteColumn = noteProbe;
        const quotes = rows.map(fromRow);
        // Advance the counter past every quote number already in the cloud so a
        // fresh browser can't reissue an existing "Q-####" (num is unique).
        const maxNum = quotes.reduce((max, q) => {
          const n = parseInt(q.num.replace(/[^0-9]/g, ''), 10);
          return Number.isFinite(n) ? Math.max(max, n) : max;
        }, 1042);
        set((s) => ({ quotes, quoteSeq: Math.max(s.quoteSeq, maxNum + 1) }));
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
          status: 'Open',
          lines: q.lines ?? [],
          discountBps: q.discountBps ?? 0,
          note: q.note ?? '',
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
