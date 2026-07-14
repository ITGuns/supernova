import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CatalogItem, TaxGroupId } from '../data/catalog';
import { useProducts } from './productStore';
import { useRegister } from './registerStore';
import { useUsers } from './userStore';

export interface CartLine {
  lineId: string;
  variantId: string;
  name: string;
  unitPriceMinor: number;
  taxGroupId: TaxGroupId;
  quantity: number;
}

export interface ParkedSale {
  id: string;
  label: string;
  lines: CartLine[];
  parkedAt: number;
}

export type TenderMethod = 'CASH' | 'CARD';

export interface Tender {
  id: string;
  method: TenderMethod;
  amountMinor: number;
}

export interface SaleLine {
  name: string;
  quantity: number;
  unitPriceMinor: number;
}

export interface CompletedSale {
  orderNumber: string;
  lines: SaleLine[];
  totalMinor: number;
  tenders: Tender[];
  changeMinor: number;
  at: number;
  training?: boolean;
  customer?: string;
  note?: string;
  soldBy?: string;
  status?: 'Completed' | 'Returned';
}

interface CartState {
  lines: CartLine[];
  parked: ParkedSale[];
  orderSeq: number;
  orderDiscountBps: number;
  customerName: string;
  orderNote: string;
  lastSale: CompletedSale | null;
  sales: CompletedSale[];

  addItem: (item: CatalogItem) => void;
  incrementLine: (lineId: string) => void;
  decrementLine: (lineId: string) => void;
  removeLine: (lineId: string) => void;
  clear: () => void;
  toggleDiscount: () => void;
  setCustomer: (name: string) => void;
  setOrderNote: (note: string) => void;

  park: () => void;
  retrieve: (id: string) => void;
  discardParked: (id: string) => void;

  completeSale: (sale: Omit<CompletedSale, 'orderNumber' | 'at'>) => CompletedSale;
  markReturned: (orderNumber: string) => void;
  dismissLastSale: () => void;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

const orderNumber = (seq: number): string => `#${1000 + seq}`;

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
  lines: [],
  parked: [],
  orderSeq: 1,
  orderDiscountBps: 0,
  customerName: '',
  orderNote: '',
  lastSale: null,
  sales: [],

  addItem: (item) =>
    set((state) => {
      const existing = state.lines.find((l) => l.variantId === item.id);
      if (existing) {
        return {
          lines: state.lines.map((l) =>
            l.variantId === item.id ? { ...l, quantity: l.quantity + 1 } : l,
          ),
        };
      }
      const line: CartLine = {
        lineId: uid(),
        variantId: item.id,
        name: item.name,
        unitPriceMinor: item.priceMinor,
        taxGroupId: item.taxGroupId,
        quantity: 1,
      };
      return { lines: [...state.lines, line] };
    }),

  incrementLine: (lineId) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.lineId === lineId ? { ...l, quantity: l.quantity + 1 } : l)),
    })),

  decrementLine: (lineId) =>
    set((state) => ({
      lines: state.lines
        .map((l) => (l.lineId === lineId ? { ...l, quantity: l.quantity - 1 } : l))
        .filter((l) => l.quantity > 0),
    })),

  removeLine: (lineId) =>
    set((state) => ({ lines: state.lines.filter((l) => l.lineId !== lineId) })),

  clear: () => set({ lines: [], orderDiscountBps: 0, customerName: '', orderNote: '' }),

  toggleDiscount: () => set((state) => ({ orderDiscountBps: state.orderDiscountBps > 0 ? 0 : 1000 })),

  setCustomer: (customerName) => set({ customerName }),
  setOrderNote: (orderNote) => set({ orderNote }),

  park: () =>
    set((state) => {
      if (state.lines.length === 0) return state;
      const parkedSale: ParkedSale = {
        id: uid(),
        label: orderNumber(state.orderSeq),
        lines: state.lines,
        parkedAt: Date.now(),
      };
      return {
        parked: [parkedSale, ...state.parked],
        lines: [],
        orderDiscountBps: 0,
        orderSeq: state.orderSeq + 1,
      };
    }),

  retrieve: (id) =>
    set((state) => {
      const sale = state.parked.find((p) => p.id === id);
      if (!sale) return state;
      return { lines: sale.lines, parked: state.parked.filter((p) => p.id !== id) };
    }),

  discardParked: (id) =>
    set((state) => ({ parked: state.parked.filter((p) => p.id !== id) })),

  completeSale: (sale) => {
    const state = get();
    const training = useRegister.getState().trainingMode;

    // Draw down inventory: reduce each sold product's "Available to sell".
    // Training-mode sales are practice runs and leave inventory untouched.
    if (!training) {
      const prodStore = useProducts.getState();
      for (const line of state.lines) {
        const prod = prodStore.products.find((p) => p.id === line.variantId);
        if (prod) prodStore.updateProduct(prod.id, { available: Math.max(0, prod.available - line.quantity) });
      }
    }

    const userState = useUsers.getState();
    const soldBy = userState.users.find((u) => u.id === userState.currentUserId)?.name ?? 'Staff';

    const completed: CompletedSale = {
      ...sale,
      orderNumber: orderNumber(state.orderSeq),
      at: Date.now(),
      training,
      customer: state.customerName || undefined,
      note: state.orderNote || undefined,
      soldBy,
      status: 'Completed',
    };
    set({
      lines: [],
      orderDiscountBps: 0,
      customerName: '',
      orderNote: '',
      orderSeq: state.orderSeq + 1,
      lastSale: completed,
      sales: [completed, ...state.sales],
    });
    return completed;
  },

  markReturned: (orderNo) => {
    const state = get();
    const sale = state.sales.find((s) => s.orderNumber === orderNo);
    if (!sale || sale.status === 'Returned') return;

    // Returns put stock back (unless it was a training sale).
    if (!sale.training) {
      const prodStore = useProducts.getState();
      for (const line of sale.lines) {
        const prod = prodStore.products.find((p) => p.name === line.name);
        if (prod) prodStore.updateProduct(prod.id, { available: prod.available + line.quantity });
      }
    }
    set({
      sales: state.sales.map((s) =>
        s.orderNumber === orderNo ? { ...s, status: 'Returned' as const } : s,
      ),
    });
  },

  dismissLastSale: () => set({ lastSale: null }),
    }),
    {
      name: 'nova-cart-v2',
      // Persist completed sales history and parked sales — not the in-progress cart or receipt.
      partialize: (s) => ({ sales: s.sales, parked: s.parked, orderSeq: s.orderSeq }),
    },
  ),
);
