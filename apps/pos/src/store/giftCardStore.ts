import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbGiftCards } from '../lib/db';

// Gift cards: sold at the register (a card is activated for the amount
// paid), redeemed on the Pay screen, and reported under Reporting → Gift
// card reports.

export type GiftCardStatus = 'Active' | 'Redeemed' | 'Cancelled';

export interface GiftCard {
  id: string;
  number: string;
  initialMinor: number;
  balanceMinor: number;
  customerName: string;
  note: string;
  status: GiftCardStatus;
  saleOrderNumber: string;
  createdAt: number;
  expiresAt: number | null;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `gc-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

/** A fresh 16-digit card number that isn't in use. */
export const newGiftCardNumber = (existing: GiftCard[]): string => {
  for (;;) {
    const n = Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join('');
    if (!existing.some((c) => c.number === n)) return n;
  }
};

export const normaliseCardNumber = (s: string): string => s.replace(/[\s-]/g, '').toUpperCase();

const toRow = (c: GiftCard): Record<string, unknown> => ({
  id: c.id,
  number: c.number,
  initial_minor: c.initialMinor,
  balance_minor: c.balanceMinor,
  customer_name: c.customerName,
  note: c.note,
  status: c.status,
  sale_order_number: c.saleOrderNumber || null,
  created_at: new Date(c.createdAt).toISOString(),
  expires_at: c.expiresAt ? new Date(c.expiresAt).toISOString() : null,
});

const fromRow = (r: Record<string, unknown>): GiftCard => ({
  id: r.id as string,
  number: (r.number as string) ?? '',
  initialMinor: Number(r.initial_minor ?? 0),
  balanceMinor: Number(r.balance_minor ?? 0),
  customerName: (r.customer_name as string) ?? '',
  note: (r.note as string) ?? '',
  status: ((r.status as string) || 'Active') as GiftCardStatus,
  saleOrderNumber: (r.sale_order_number as string | null) ?? '',
  createdAt: r.created_at ? new Date(r.created_at as string).getTime() : Date.now(),
  expiresAt: r.expires_at ? new Date(r.expires_at as string).getTime() : null,
});

interface GiftCardState {
  cards: GiftCard[];
  syncFromDb: () => Promise<void>;
  /** Activate (or top up) a card for the amount paid. Returns the card. */
  issue: (number: string, amountMinor: number, opts?: { customerName?: string; note?: string; saleOrderNumber?: string; expiresAt?: number | null }) => GiftCard;
  /** Take `amountMinor` off the card; returns what was actually taken. */
  redeem: (number: string, amountMinor: number) => number;
  /** Put money back on a card (a return refunded to gift card). */
  refund: (number: string, amountMinor: number) => void;
  cancel: (id: string) => void;
  find: (number: string) => GiftCard | undefined;
}

export const useGiftCards = create<GiftCardState>()(
  persist(
    (set, get) => ({
      cards: [],
      syncFromDb: async () => {
        const rows = await dbGiftCards.list();
        if (rows === null || rows === 'missing') return;
        set({ cards: rows.map(fromRow) });
      },
      find: (number) => get().cards.find((c) => c.number === normaliseCardNumber(number)),
      issue: (number, amountMinor, opts = {}) => {
        const num = normaliseCardNumber(number);
        const existing = get().cards.find((c) => c.number === num);
        let card: GiftCard;
        if (existing) {
          card = { ...existing, initialMinor: existing.initialMinor + amountMinor, balanceMinor: existing.balanceMinor + amountMinor, status: 'Active', saleOrderNumber: opts.saleOrderNumber ?? existing.saleOrderNumber };
          set((s) => ({ cards: s.cards.map((c) => (c.id === card.id ? card : c)) }));
        } else {
          card = { id: uid(), number: num, initialMinor: amountMinor, balanceMinor: amountMinor, customerName: opts.customerName ?? '', note: opts.note ?? '', status: 'Active', saleOrderNumber: opts.saleOrderNumber ?? '', createdAt: Date.now(), expiresAt: opts.expiresAt ?? null };
          set((s) => ({ cards: [card, ...s.cards] }));
        }
        dbGiftCards.upsert(toRow(card));
        return card;
      },
      redeem: (number, amountMinor) => {
        const card = get().find(number);
        if (!card || card.status !== 'Active') return 0;
        const taken = Math.min(card.balanceMinor, Math.max(0, amountMinor));
        const balance = card.balanceMinor - taken;
        const updated: GiftCard = { ...card, balanceMinor: balance, status: balance === 0 ? 'Redeemed' : 'Active' };
        set((s) => ({ cards: s.cards.map((c) => (c.id === card.id ? updated : c)) }));
        dbGiftCards.upsert(toRow(updated));
        return taken;
      },
      refund: (number, amountMinor) => {
        const card = get().find(number);
        if (!card) return;
        const updated: GiftCard = { ...card, balanceMinor: card.balanceMinor + amountMinor, status: 'Active' };
        set((s) => ({ cards: s.cards.map((c) => (c.id === card.id ? updated : c)) }));
        dbGiftCards.upsert(toRow(updated));
      },
      cancel: (id) => {
        const card = get().cards.find((c) => c.id === id);
        if (!card) return;
        const updated: GiftCard = { ...card, status: 'Cancelled' };
        set((s) => ({ cards: s.cards.map((c) => (c.id === id ? updated : c)) }));
        dbGiftCards.upsert(toRow(updated));
      },
    }),
    { name: 'nova-gift-cards-v1' },
  ),
);
