import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CatalogItem, TaxGroupId } from '../data/catalog';
import { useCatalogMeta } from './catalogMetaStore';
import { useCustomers } from './customerStore';
import { priceBookPrice, usePriceBooks } from './priceBookStore';
import { stockLinesFor, useProducts } from './productStore';
import { bestPromotion, promoLabel, usePromotions } from './promotionStore';
import { useRegister } from './registerStore';
import { useUsers } from './userStore';
import { useSerialNumbers } from './serialNumberStore';
import { useGiftCards } from './giftCardStore';
import { runRules } from '../lib/rules';
import { dbSales, dbParked } from '../lib/db';

export interface CartLine {
  lineId: string;
  variantId: string;
  name: string;
  unitPriceMinor: number;
  taxGroupId: TaxGroupId;
  quantity: number;
  /** The product's normal retail price when a price book or promotion changed it. */
  basePriceMinor?: number;
  /** Why the price differs from normal, e.g. "VIP price book" or "Summer sale · 10% off". */
  priceNote?: string;
  /** A one-off service line typed at the register (no product, no stock). */
  custom?: boolean;
  /** Percentage typed on the line itself (0–100). */
  discountPct?: number;
  /** Line note, printed on the receipt. */
  note?: string;
  /** Staff member the line is attributed to. */
  soldBy?: string;
  /** Lines of a continued layaway / on-account sale can't be edited. */
  locked?: boolean;
  /** Serial number of the unit being sold (serialised products). */
  serial?: string;
  /** A gift card being sold: activated for the line's price when the sale completes. */
  giftCard?: { number: string };
}

export type FulfillmentKind = 'pack' | 'pickup' | 'delivery';
export type SaleFulfillmentStatus = 'Unfulfilled' | 'Fulfilled' | 'Cancelled';
export interface SaleFulfillment {
  kind: FulfillmentKind;
  status: SaleFulfillmentStatus;
  note?: string;
  updatedAt?: number;
}

/** The customer group of the customer attached to the sale, by name. */
const customerGroupOf = (customerName: string): string | null => {
  const n = customerName.trim().toLowerCase();
  if (!n) return null;
  const c = useCustomers.getState().customers.find((x) => `${x.firstName} ${x.lastName}`.trim().toLowerCase() === n);
  return c?.group ?? null;
};

/**
 * What a product sells for right now: its price book price for the
 * customer's group (if any), then the best active promotion on top.
 */
export const pricedFor = (
  item: Pick<CatalogItem, 'id' | 'productId' | 'categoryId' | 'priceMinor'>,
  customerName: string,
  promoCode = '',
): { unitPriceMinor: number; basePriceMinor: number; priceNote?: string } => {
  const base = item.priceMinor;
  const group = customerGroupOf(customerName);
  const pb = priceBookPrice(item.id, group, usePriceBooks.getState().priceBooks);
  let price = pb ? pb.priceMinor : base;
  let note = pb ? pb.book.name : undefined;
  const promo = bestPromotion(item, price, usePromotions.getState().promotions, useCatalogMeta.getState().categories, { group, promoCode });
  if (promo) {
    price = promo.priceMinor;
    note = `${promo.promotion.name} · ${promoLabel(promo.promotion)}`;
  }
  return { unitPriceMinor: price, basePriceMinor: base, priceNote: note };
};

export interface ParkedSale {
  id: string;
  label: string;
  lines: CartLine[];
  parkedAt: number;
  /** Order-level state preserved so the sale restores exactly as parked. */
  discountBps: number;
  customerName: string;
  note: string;
}

/**
 * 'CASH' and 'CARD' are the two built-in payment types; any other payment
 * type configured in Setup → Payment types is recorded by its id.
 */
export type TenderMethod = string;

export interface Tender {
  id: string;
  method: TenderMethod;
  amountMinor: number;
  /** Check number etc., when the payment type asks for one. */
  reference?: string;
}

export interface SaleLine {
  name: string;
  quantity: number;
  unitPriceMinor: number;
  /** Product id, so a return restocks the exact variant (names can repeat). */
  variantId?: string;
  /** Supplier cost per unit when the sale was made — the basis for gross profit. */
  costMinor?: number;
  discountPct?: number;
  note?: string;
  soldBy?: string;
  serial?: string;
  giftCard?: { number: string };
}

/**
 * Completed: paid in full. Layaway / On account: open, paid partly or not at
 * all, continued from Sales history. Returned: refunded. Voided: cancelled
 * without a refund (stock back, payments dropped from reports).
 */
export type SaleStatus = 'Completed' | 'Returned' | 'Partially returned' | 'Voided' | 'Layaway' | 'On account';

export interface CompletedSale {
  orderNumber: string;
  lines: SaleLine[];
  totalMinor: number;
  /** Tax charged on the sale (part of totalMinor). */
  taxMinor?: number;
  /** Order-level discount taken off before tax. */
  discountMinor?: number;
  tenders: Tender[];
  changeMinor: number;
  at: number;
  training?: boolean;
  customer?: string;
  note?: string;
  soldBy?: string;
  status?: SaleStatus;
  /** What went back to the customer on return — one entry per original method. */
  refundTenders?: Tender[];
  refundedAt?: number;
  /** Taken so far on a layaway / on-account sale (net of change). */
  paidMinor?: number;
  voidedAt?: number;
  /** Reference typed for a check / other payment type. */
  emailReceipt?: boolean;
  /** Pack / pickup / delivery order attached at the register. */
  fulfillment?: SaleFulfillment;
  /** Units returned so far, by line index (partial returns). */
  returnedLines?: Record<string, number>;
  /** Values of the sale's custom fields (Setup → Workflows). */
  customFields?: Record<string, string>;
}

/** Units of a line that have been returned. */
export const returnedQty = (s: CompletedSale, index: number): number => s.returnedLines?.[String(index)] ?? 0;
/** What has been refunded on the sale so far. */
export const saleRefunded = (s: CompletedSale): number => (s.refundTenders ?? []).reduce((a, t) => a + t.amountMinor, 0);
/** Value of a line after its own discount (before order discount and tax). */
export const lineValue = (l: SaleLine, qty = l.quantity): number => Math.round(l.unitPriceMinor * qty * (1 - (l.discountPct ?? 0) / 100));
/**
 * What returning `items` refunds: each line's share of the sale total (so
 * order discounts and tax come off proportionally).
 */
export const refundAmountFor = (s: CompletedSale, items: { index: number; quantity: number }[]): number => {
  const gross = s.lines.reduce((a, l) => a + lineValue(l), 0);
  if (gross <= 0) return 0;
  const value = items.reduce((a, it) => {
    const l = s.lines[it.index];
    return a + (l ? lineValue(l, it.quantity) : 0);
  }, 0);
  const remaining = s.totalMinor - saleRefunded(s);
  return Math.min(remaining, Math.round((s.totalMinor * value) / gross));
};

/** What is still owed on a sale. */
export const saleBalance = (s: CompletedSale): number =>
  s.status === 'Layaway' || s.status === 'On account' ? Math.max(0, s.totalMinor - (s.paidMinor ?? 0)) : 0;
/** Sales that count as revenue: not returned, not voided (partial returns still count for what was kept). */
export const saleCounts = (s: CompletedSale): boolean => s.status !== 'Returned' && s.status !== 'Voided';

/**
 * Refund for a full return: each method gets back what it actually paid.
 * Cash is net of the change handed over at the sale, so the refund total
 * always equals the sale total.
 */
export const refundFor = (sale: CompletedSale, amountMinor?: number): Tender[] => {
  const byMethod = new Map<TenderMethod, number>();
  for (const t of sale.tenders) byMethod.set(t.method, (byMethod.get(t.method) ?? 0) + t.amountMinor);
  // Cash is net of the change handed over at the sale.
  if (byMethod.has('CASH')) byMethod.set('CASH', (byMethod.get('CASH') ?? 0) - sale.changeMinor);
  // Anything already refunded comes off each method first.
  for (const t of sale.refundTenders ?? []) byMethod.set(t.method, (byMethod.get(t.method) ?? 0) - t.amountMinor);
  const paid = [...byMethod.entries()].filter(([, v]) => v > 0);
  const paidTotal = paid.reduce((a, [, v]) => a + v, 0);
  const want = amountMinor === undefined ? paidTotal : Math.min(amountMinor, paidTotal);
  const out: Tender[] = [];
  let left = want;
  paid.forEach(([method, v], i) => {
    const share = i === paid.length - 1 ? left : Math.min(left, Math.round((want * v) / paidTotal));
    if (share > 0) out.push({ id: uid(), method, amountMinor: share });
    left -= share;
  });
  return out;
};

// ── Sale economics ───────────────────────────────────────────────────────────

/** Revenue excluding tax: what the store actually keeps before costs (net of partial refunds). */
export const saleRevenue = (s: CompletedSale): number => {
  const refunded = s.status === 'Partially returned' ? saleRefunded(s) : 0;
  const net = s.totalMinor - refunded;
  const taxShare = s.totalMinor > 0 ? Math.round(((s.taxMinor ?? 0) * net) / s.totalMinor) : 0;
  return net - taxShare;
};

/**
 * Cost of the goods on a sale. Each line carries the supplier cost at the
 * time of sale; older sales recorded before that fall back to the product's
 * current supplier price.
 */
export const saleCost = (s: CompletedSale, products: { id: string; supplierPriceMinor?: number }[]): number =>
  s.lines.reduce((sum, l, i) => {
    const unit = l.costMinor ?? products.find((p) => p.id === l.variantId)?.supplierPriceMinor ?? 0;
    return sum + unit * Math.max(0, l.quantity - (s.status === 'Partially returned' ? returnedQty(s, i) : 0));
  }, 0);

export const saleProfit = (s: CompletedSale, products: { id: string; supplierPriceMinor?: number }[]): number =>
  saleRevenue(s) - saleCost(s, products);

interface CartState {
  lines: CartLine[];
  parked: ParkedSale[];
  orderSeq: number;
  orderDiscountBps: number;
  /** Fixed-amount sale discount (used when orderDiscountBps is 0). */
  orderDiscountMinor: number;
  /** Tax removed from this sale (Sell screen → Tax → delete). */
  taxRemoved: boolean;
  /** Promo code entered on the sale (unlocks code-only promotions). */
  promoCode: string;
  /** Order number of the layaway / on-account sale being continued, if any. */
  openSaleNumber: string | null;
  customerName: string;
  orderNote: string;
  /** Pack / pickup / delivery chosen for this sale (Mark as unfulfilled). */
  fulfillment: { kind: FulfillmentKind; note: string } | null;
  /** Values typed for the sale's custom fields. */
  customFields: Record<string, string>;
  /** A line just added for a serialised product that still needs its serial picked. */
  pendingSerial: string | null;
  /** Messages business rules asked the cashier to see after the last sale. */
  lastSaleNotices: string[];
  /** Payments taken so far on the Pay screen (before the sale completes). */
  pendingTenders: Tender[];
  /** Whether the Pay screen is open (the sale panel shows payments and balance). */
  paying: boolean;
  lastSale: CompletedSale | null;
  sales: CompletedSale[];

  /** Pull sales + parked from Supabase. */
  syncFromDb: () => Promise<void>;

  addItem: (item: CatalogItem) => void;
  /** A service or other one-off line with a typed price (no product, no stock). */
  addCustomLine: (line: { name: string; priceMinor: number }) => void;
  /** Replace the sale with saved lines (a quote or fulfillment being retrieved). */
  loadLines: (lines: CartLine[], opts?: { customerName?: string; discountBps?: number; note?: string }) => void;
  incrementLine: (lineId: string) => void;
  decrementLine: (lineId: string) => void;
  removeLine: (lineId: string) => void;
  clear: () => void;
  toggleDiscount: () => void;
  /** Whole-sale discount as a percentage or a fixed amount (either may be 0). */
  setOrderDiscount: (d: { bps?: number; amountMinor?: number }) => void;
  setTaxRemoved: (removed: boolean) => void;
  /** Apply a promo code; false when no active promotion carries it. */
  setPromoCode: (code: string) => boolean;
  updateLine: (lineId: string, patch: Partial<Pick<CartLine, 'quantity' | 'unitPriceMinor' | 'discountPct' | 'note' | 'soldBy'>>) => void;
  /** Attribute every line of the sale to one staff member. */
  assignAllLines: (soldBy: string) => void;
  setCustomer: (name: string) => void;
  setOrderNote: (note: string) => void;
  setFulfillment: (f: { kind: FulfillmentKind; note: string } | null) => void;
  setPaying: (paying: boolean) => void;
  addPendingTender: (t: Tender) => void;
  removePendingTender: (id: string) => void;
  clearPendingTenders: () => void;
  setCustomFields: (cf: Record<string, string>) => void;
  /** Record the serial being sold on a line ('' = none) and close the prompt. */
  setLineSerial: (lineId: string, serial: string) => void;
  /** Sell a gift card: a line for the amount that activates the card on completion. */
  addGiftCardLine: (number: string, amountMinor: number) => void;
  /** Return some or all items: stock back, refund recorded, status updated. */
  returnItems: (orderNumber: string, items: { index: number; quantity: number }[], refundTenders: Tender[]) => void;
  /** Edit payments: swap the tender methods / references of a completed sale (amounts must still add up). */
  updateTenders: (orderNumber: string, tenders: Tender[]) => void;
  setFulfillmentStatus: (orderNumber: string, status: SaleFulfillmentStatus) => void;

  park: (note?: string) => void;
  retrieve: (id: string) => void;
  discardParked: (id: string) => void;

  completeSale: (sale: Omit<CompletedSale, 'orderNumber' | 'at'>) => CompletedSale;
  markReturned: (orderNumber: string) => void;
  /** Cancel a sale without refunding: stock back, payments dropped from reports. */
  voidSale: (orderNumber: string) => void;
  /** Put an open layaway / on-account sale back on the register to take payment. */
  continueSale: (orderNumber: string) => void;
  /** Record payments (and any added lines) against the open sale being continued. */
  payOpenSale: (orderNumber: string, tenders: Tender[], changeMinor: number, addedLines: SaleLine[], addedTotalMinor: number, toStatus: SaleStatus) => CompletedSale | null;
  dismissLastSale: () => void;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

const orderNumber = (seq: number): string => `#${1000 + seq}`;

// Whether the cloud `sales` table has the refund columns from migration 0004.
// Detected from the first synced row so a return on an older schema still
// persists its status instead of failing the whole update.
let hasRefundColumns = true;
// Whether it has the tax / discount columns from migration 0008.
let hasTaxColumns = true;
// Whether it has the paid / voided columns from migration 0009.
let hasPaidColumns = true;
// Whether it has returned_lines / custom_fields from migration 0011.
let hasReturnColumns = true;

/** Parse the numeric part of an order label like "#1002" → 1002. */
const orderNumToInt = (label: string): number => {
  const n = parseInt(label.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};

// Map a CompletedSale to the sales table row (snake_case).
const saleToRow = (s: CompletedSale): Record<string, unknown> => ({
  order_number: s.orderNumber,
  lines: s.lines,
  total_minor: s.totalMinor,
  tenders: s.tenders,
  change_minor: s.changeMinor,
  sold_at: new Date(s.at).toISOString(),
  ...(hasTaxColumns ? { tax_minor: s.taxMinor ?? 0, discount_minor: s.discountMinor ?? 0 } : {}),
  ...(hasPaidColumns ? { paid_minor: s.paidMinor ?? null, voided_at: s.voidedAt ? new Date(s.voidedAt).toISOString() : null, fulfillment: s.fulfillment ?? null } : {}),
  ...(hasReturnColumns ? { returned_lines: s.returnedLines ?? null, custom_fields: s.customFields ?? {} } : {}),
  training: s.training ?? false,
  customer_name: s.customer ?? null,
  note: s.note ?? null,
  sold_by: s.soldBy ?? null,
  status: s.status ?? 'Completed',
  // Only sent once a refund exists, so inserting a new sale never touches
  // these columns and keeps working on a schema that predates migration 0004.
  ...(s.refundedAt
    ? { refund_tenders: s.refundTenders ?? [], refunded_at: new Date(s.refundedAt).toISOString() }
    : {}),
});

// Map a DB sales row back to CompletedSale.
const rowToSale = (r: Record<string, unknown>): CompletedSale => ({
  orderNumber: r.order_number as string,
  lines: r.lines as SaleLine[],
  totalMinor: r.total_minor as number,
  tenders: r.tenders as Tender[],
  changeMinor: r.change_minor as number,
  taxMinor: (r.tax_minor as number | null) ?? 0,
  discountMinor: (r.discount_minor as number | null) ?? 0,
  at: new Date(r.sold_at as string).getTime(),
  training: r.training as boolean,
  customer: r.customer_name as string | undefined,
  note: r.note as string | undefined,
  soldBy: r.sold_by as string | undefined,
  status: r.status as CompletedSale['status'],
  refundTenders: (r.refund_tenders as Tender[] | null) ?? [],
  refundedAt: r.refunded_at ? new Date(r.refunded_at as string).getTime() : undefined,
  paidMinor: (r.paid_minor as number | null) ?? undefined,
  voidedAt: r.voided_at ? new Date(r.voided_at as string).getTime() : undefined,
  fulfillment: (r.fulfillment as SaleFulfillment | null) ?? undefined,
  returnedLines: (r.returned_lines as Record<string, number> | null) ?? undefined,
  customFields: (r.custom_fields as Record<string, string> | null) ?? undefined,
});

// Map a ParkedSale to the parked_sales table row.
const parkedToRow = (p: ParkedSale): Record<string, unknown> => ({
  id: p.id,
  label: p.label,
  lines: p.lines,
  parked_at: new Date(p.parkedAt).toISOString(),
  discount_bps: p.discountBps,
  customer_name: p.customerName || null,
  note: p.note || null,
});

const rowToParked = (r: Record<string, unknown>): ParkedSale => ({
  id: r.id as string,
  label: r.label as string,
  lines: r.lines as CartLine[],
  parkedAt: new Date(r.parked_at as string).getTime(),
  discountBps: (r.discount_bps as number | null) ?? 0,
  customerName: (r.customer_name as string | null) ?? '',
  note: (r.note as string | null) ?? '',
});

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
  lines: [],
  parked: [],
  orderSeq: 1,
  orderDiscountBps: 0,
  orderDiscountMinor: 0,
  taxRemoved: false,
  promoCode: '',
  openSaleNumber: null,
  customerName: '',
  orderNote: '',
  fulfillment: null,
  customFields: {},
  pendingSerial: null,
  lastSaleNotices: [],
  pendingTenders: [],
  paying: false,
  lastSale: null,
  sales: [],

  syncFromDb: async () => {
    const [salesRows, parkedRows] = await Promise.all([
      dbSales.list(),
      dbParked.list(),
    ]);
    if (!salesRows || !parkedRows) return; // request failed — keep cached history
    const sales = salesRows.map(rowToSale);
    const parked = parkedRows.map(rowToParked);
    if (salesRows[0]) {
      hasRefundColumns = 'refund_tenders' in salesRows[0];
      hasTaxColumns = 'tax_minor' in salesRows[0];
      hasPaidColumns = 'paid_minor' in salesRows[0];
      hasReturnColumns = 'returned_lines' in salesRows[0];
    } else {
      const [taxProbe, paidProbe, returnProbe] = await Promise.all([dbSales.hasTaxColumns(), dbSales.hasPaidColumns(), dbSales.hasReturnedLines()]);
      if (taxProbe !== null) hasTaxColumns = taxProbe;
      if (paidProbe !== null) hasPaidColumns = paidProbe;
      if (returnProbe !== null) hasReturnColumns = returnProbe;
    }
    // Advance the order counter past every number already in the cloud so a
    // fresh browser (empty localStorage) can never reissue an existing number.
    const maxNum = Math.max(
      1000,
      ...sales.map((s) => orderNumToInt(s.orderNumber)),
      ...parked.map((p) => orderNumToInt(p.label)),
    );
    set((state) => ({
      sales,
      parked,
      orderSeq: Math.max(state.orderSeq, maxNum - 1000 + 1),
    }));
  },

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
      const priced = pricedFor(item, state.customerName, state.promoCode);
      const line: CartLine = {
        lineId: uid(),
        variantId: item.id,
        name: item.name,
        unitPriceMinor: priced.unitPriceMinor,
        taxGroupId: item.taxGroupId,
        quantity: 1,
        ...(priced.priceNote ? { basePriceMinor: priced.basePriceMinor, priceNote: priced.priceNote } : {}),
      };
      // A product with serial numbers on file asks which unit is being sold.
      const hasSerials = useSerialNumbers.getState().serials.some((sn) => sn.productId === item.id && sn.status === 'In stock');
      return { lines: [...state.lines, line], ...(hasSerials ? { pendingSerial: line.lineId } : {}) };
    }),

  setLineSerial: (lineId, serial) =>
    set((state) => ({
      pendingSerial: state.pendingSerial === lineId ? null : state.pendingSerial,
      lines: state.lines.map((l) => (l.lineId === lineId ? { ...l, serial: serial || undefined } : l)),
    })),

  addGiftCardLine: (number, amountMinor) =>
    set((state) => ({
      lines: [
        ...state.lines,
        { lineId: uid(), variantId: `giftcard-${uid()}`, name: `Gift card ${number.slice(-4).padStart(number.length > 4 ? 8 : 4, '•')}`, unitPriceMinor: Math.max(0, amountMinor), taxGroupId: 'exempt', quantity: 1, custom: true, giftCard: { number } },
      ],
    })),

  setFulfillment: (fulfillment) => set({ fulfillment }),
  // Going back to the sale keeps any payments already taken; discarding the sale clears them.
  setPaying: (paying) => set({ paying }),
  addPendingTender: (t) => set((state) => ({ pendingTenders: [...state.pendingTenders, t] })),
  removePendingTender: (id) => set((state) => ({ pendingTenders: state.pendingTenders.filter((t) => t.id !== id) })),
  clearPendingTenders: () => set({ pendingTenders: [] }),
  setCustomFields: (customFields) => set({ customFields }),

  addCustomLine: ({ name, priceMinor }) =>
    set((state) => ({
      lines: [
        ...state.lines,
        { lineId: uid(), variantId: `custom-${uid()}`, name, unitPriceMinor: Math.max(0, priceMinor), taxGroupId: 'standard', quantity: 1, custom: true },
      ],
    })),

  loadLines: (lines, opts = {}) =>
    set({
      lines: lines.map((l) => ({ ...l, lineId: uid() })),
      customerName: opts.customerName ?? '',
      orderDiscountBps: opts.discountBps ?? 0,
      orderNote: opts.note ?? '',
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

  clear: () => set({ lines: [], orderDiscountBps: 0, orderDiscountMinor: 0, taxRemoved: false, promoCode: '', openSaleNumber: null, customerName: '', orderNote: '', fulfillment: null, customFields: {}, pendingSerial: null, pendingTenders: [], paying: false }),

  toggleDiscount: () => set((state) => ({ orderDiscountBps: state.orderDiscountBps > 0 ? 0 : 1000, orderDiscountMinor: 0 })),

  setOrderDiscount: (d) => set({ orderDiscountBps: Math.max(0, Math.min(10000, d.bps ?? 0)), orderDiscountMinor: Math.max(0, d.amountMinor ?? 0) }),

  setTaxRemoved: (taxRemoved) => set({ taxRemoved }),

  setPromoCode: (raw) => {
    const code = raw.trim().toUpperCase();
    if (code && !usePromotions.getState().promotions.some((p) => p.target === 'code' && p.promoCode.toUpperCase() === code && p.active)) return false;
    set((state) => ({
      promoCode: code,
      lines: state.lines.map((l) => {
        if (l.custom || l.locked) return l;
        const product = useProducts.getState().products.find((p) => p.id === l.variantId);
        if (!product) return l;
        const priced = pricedFor(product, state.customerName, code);
        return { ...l, unitPriceMinor: priced.unitPriceMinor, basePriceMinor: priced.priceNote ? priced.basePriceMinor : undefined, priceNote: priced.priceNote };
      }),
    }));
    return true;
  },

  updateLine: (lineId, patch) =>
    set((state) => ({
      lines: state.lines
        .map((l) => (l.lineId === lineId && !l.locked ? { ...l, ...patch } : l))
        .filter((l) => l.quantity > 0),
    })),

  assignAllLines: (soldBy) => set((state) => ({ lines: state.lines.map((l) => ({ ...l, soldBy })) })),

  // Changing the customer can change the price book, so product lines are
  // re-priced (service lines keep their typed price).
  setCustomer: (customerName) =>
    set((state) => ({
      customerName,
      lines: state.lines.map((l) => {
        if (l.custom || l.locked) return l;
        const product = useProducts.getState().products.find((p) => p.id === l.variantId);
        if (!product) return l;
        const priced = pricedFor(product, customerName, state.promoCode);
        return {
          ...l,
          unitPriceMinor: priced.unitPriceMinor,
          basePriceMinor: priced.priceNote ? priced.basePriceMinor : undefined,
          priceNote: priced.priceNote,
        };
      }),
    })),
  setOrderNote: (orderNote) => set({ orderNote }),

  park: (note) =>
    set((state) => {
      if (state.lines.length === 0) return state;
      const parkedSale: ParkedSale = {
        id: uid(),
        label: orderNumber(state.orderSeq),
        lines: state.lines,
        parkedAt: Date.now(),
        discountBps: state.orderDiscountBps,
        customerName: state.customerName,
        note: note?.trim() || state.orderNote,
      };
      dbParked.insert(parkedToRow(parkedSale));
      return {
        parked: [parkedSale, ...state.parked],
        lines: [],
        orderDiscountBps: 0,
        orderDiscountMinor: 0,
        taxRemoved: false,
        promoCode: '',
        openSaleNumber: null,
        customerName: '',
        orderNote: '',
        fulfillment: null,
        customFields: {},
        pendingSerial: null,
        orderSeq: state.orderSeq + 1,
      };
    }),

  retrieve: (id) =>
    set((state) => {
      const sale = state.parked.find((p) => p.id === id);
      if (!sale) return state;
      dbParked.del(id);
      return {
        lines: sale.lines,
        orderDiscountBps: sale.discountBps,
        customerName: sale.customerName,
        orderNote: sale.note,
        parked: state.parked.filter((p) => p.id !== id),
      };
    }),

  discardParked: (id) => {
    set((state) => ({ parked: state.parked.filter((p) => p.id !== id) }));
    dbParked.del(id);
  },

  completeSale: (sale) => {
    const state = get();
    const training = useRegister.getState().trainingMode;

    // Draw down inventory (skip training-mode runs).
    if (!training) {
      const prodStore = useProducts.getState();
      for (const line of state.lines) {
        const prod = prodStore.products.find((p) => p.id === line.variantId);
        if (!prod) continue;
        // A composite consumes its components' stock, not its own.
        for (const s of stockLinesFor(prod, line.quantity)) prodStore.adjustStock(s.id, s.delta);
      }
    }

    const userState = useUsers.getState();
    const soldBy = userState.users.find((u) => u.id === userState.currentUserId)?.name ?? 'Staff';
    const number = orderNumber(state.orderSeq);

    const completed: CompletedSale = {
      ...sale,
      orderNumber: number,
      at: Date.now(),
      training,
      customer: state.customerName || undefined,
      note: state.orderNote || undefined,
      soldBy,
      status: sale.status ?? 'Completed',
      ...(state.fulfillment ? { fulfillment: { kind: state.fulfillment.kind, status: 'Unfulfilled' as const, note: state.fulfillment.note, updatedAt: Date.now() } } : {}),
      ...(Object.keys(state.customFields).length ? { customFields: state.customFields } : {}),
    };

    if (!training) {
      // Serialised units leave stock by serial; gift cards sold are activated for the amount paid.
      for (const line of state.lines) {
        if (line.serial) useSerialNumbers.getState().markSold(line.variantId, line.serial, number);
        if (line.giftCard) useGiftCards.getState().issue(line.giftCard.number, line.unitPriceMinor * line.quantity, { customerName: state.customerName, saleOrderNumber: number });
      }
      // Products that just dropped to their reorder point.
      const prodStore = useProducts.getState();
      for (const line of state.lines) {
        const p = prodStore.products.find((x) => x.id === line.variantId);
        if (!p || p.trackInventory === false) continue;
        const at = p.replenishMethod === 'reorder' ? p.reorderPoint : p.minQty;
        if (at != null && p.available <= at) runRules('Product low on stock', { productName: p.name, stock: p.available, user: soldBy });
      }
    }

    // Persist to Supabase.
    dbSales.insert(saleToRow(completed));

    set({
      lines: [],
      orderDiscountBps: 0,
      orderDiscountMinor: 0,
      taxRemoved: false,
      promoCode: '',
      openSaleNumber: null,
      customerName: '',
      orderNote: '',
      fulfillment: null,
      customFields: {},
      pendingSerial: null,
      pendingTenders: [],
      paying: false,
      orderSeq: state.orderSeq + 1,
      lastSale: completed,
      sales: [completed, ...state.sales],
    });
    return completed;
  },

  returnItems: (orderNo, items, refundTenders) => {
    const state = get();
    const sale = state.sales.find((s) => s.orderNumber === orderNo);
    if (!sale || sale.status === 'Returned' || sale.status === 'Voided') return;
    const returnedLines: Record<string, number> = { ...(sale.returnedLines ?? {}) };
    const prodStore = useProducts.getState();
    for (const it of items) {
      const line = sale.lines[it.index];
      if (!line) continue;
      const already = returnedLines[String(it.index)] ?? 0;
      const qty = Math.max(0, Math.min(it.quantity, line.quantity - already));
      if (qty === 0) continue;
      returnedLines[String(it.index)] = already + qty;
      if (!sale.training) {
        const prod = line.variantId ? prodStore.products.find((p) => p.id === line.variantId) : prodStore.products.find((p) => p.name === line.name);
        if (prod) for (const s of stockLinesFor(prod, qty)) prodStore.adjustStock(s.id, -s.delta);
        if (line.serial && line.variantId) {
          const sn = useSerialNumbers.getState().serials.find((x) => x.productId === line.variantId && x.serial === line.serial);
          if (sn) useSerialNumbers.getState().updateSerial(sn.id, { status: 'Returned', soldAt: null, saleOrderNumber: '' });
        }
        if (line.giftCard) useGiftCards.getState().redeem(line.giftCard.number, line.unitPriceMinor * qty);
      }
    }
    // Refunds paid back onto a gift card top the card up again.
    for (const t of refundTenders) if (t.method.startsWith('GIFT:')) useGiftCards.getState().refund(t.method.slice(5), t.amountMinor);
    const allBack = sale.lines.every((l, i) => (returnedLines[String(i)] ?? 0) >= l.quantity);
    const refundedAt = Date.now();
    const allRefunds = [...(sale.refundTenders ?? []), ...refundTenders];
    const status: SaleStatus = allBack ? 'Returned' : 'Partially returned';
    dbSales.update(orderNo, {
      status,
      ...(hasRefundColumns ? { refund_tenders: allRefunds, refunded_at: new Date(refundedAt).toISOString() } : {}),
      ...(hasReturnColumns ? { returned_lines: returnedLines } : {}),
    });
    set({ sales: state.sales.map((s) => (s.orderNumber === orderNo ? { ...s, status, refundTenders: allRefunds, refundedAt, returnedLines } : s)) });
    runRules('Refund processed', { totalMinor: refundTenders.reduce((a, t) => a + t.amountMinor, 0), customerName: sale.customer ?? '' });
  },

  updateTenders: (orderNo, tenders) => {
    const state = get();
    const sale = state.sales.find((s) => s.orderNumber === orderNo);
    if (!sale) return;
    dbSales.update(orderNo, { tenders });
    set({ sales: state.sales.map((s) => (s.orderNumber === orderNo ? { ...s, tenders } : s)) });
  },

  setFulfillmentStatus: (orderNo, status) => {
    const state = get();
    const sale = state.sales.find((s) => s.orderNumber === orderNo);
    if (!sale?.fulfillment) return;
    const fulfillment: SaleFulfillment = { ...sale.fulfillment, status, updatedAt: Date.now() };
    if (hasPaidColumns) dbSales.update(orderNo, { fulfillment });
    set({ sales: state.sales.map((s) => (s.orderNumber === orderNo ? { ...s, fulfillment } : s)) });
  },

  voidSale: (orderNo) => {
    const state = get();
    const sale = state.sales.find((s) => s.orderNumber === orderNo);
    if (!sale || sale.status === 'Voided') return;
    // Everything sold goes back into stock; a returned sale already did that.
    if (!sale.training && sale.status !== 'Returned') {
      const prodStore = useProducts.getState();
      for (const line of sale.lines) {
        const prod = line.variantId ? prodStore.products.find((p) => p.id === line.variantId) : prodStore.products.find((p) => p.name === line.name);
        if (!prod) continue;
        for (const s of stockLinesFor(prod, line.quantity)) prodStore.adjustStock(s.id, -s.delta);
      }
    }
    const voidedAt = Date.now();
    dbSales.update(orderNo, { status: 'Voided', ...(hasPaidColumns ? { voided_at: new Date(voidedAt).toISOString() } : {}) });
    set({ sales: state.sales.map((s) => (s.orderNumber === orderNo ? { ...s, status: 'Voided' as const, voidedAt } : s)) });
  },

  continueSale: (orderNo) => {
    const sale = get().sales.find((s) => s.orderNumber === orderNo);
    if (!sale || (sale.status !== 'Layaway' && sale.status !== 'On account')) return;
    set({
      lines: sale.lines.map((l) => ({
        lineId: uid(),
        variantId: l.variantId ?? `custom-${uid()}`,
        name: l.name,
        unitPriceMinor: l.unitPriceMinor,
        taxGroupId: 'standard',
        quantity: l.quantity,
        discountPct: l.discountPct,
        note: l.note,
        soldBy: l.soldBy,
        locked: true,
      })),
      orderDiscountBps: 0,
      orderDiscountMinor: sale.discountMinor ?? 0,
      taxRemoved: false,
      promoCode: '',
      openSaleNumber: orderNo,
      customerName: sale.customer ?? '',
      orderNote: sale.note ?? '',
    });
  },

  payOpenSale: (orderNo, tenders, changeMinor, addedLines, addedTotalMinor, toStatus) => {
    const state = get();
    const sale = state.sales.find((s) => s.orderNumber === orderNo);
    if (!sale) return null;
    // Newly added items leave stock now, like the original lines did.
    if (!sale.training && addedLines.length) {
      const prodStore = useProducts.getState();
      for (const line of addedLines) {
        const prod = prodStore.products.find((p) => p.id === line.variantId);
        if (!prod) continue;
        for (const s of stockLinesFor(prod, line.quantity)) prodStore.adjustStock(s.id, s.delta);
      }
    }
    const paid = (sale.paidMinor ?? 0) + tenders.reduce((a, t) => a + t.amountMinor, 0) - changeMinor;
    const totalMinor = sale.totalMinor + addedTotalMinor;
    const status: SaleStatus = paid >= totalMinor ? 'Completed' : toStatus;
    const updated: CompletedSale = {
      ...sale,
      lines: [...sale.lines, ...addedLines],
      totalMinor,
      tenders: [...sale.tenders, ...tenders],
      changeMinor: sale.changeMinor + changeMinor,
      paidMinor: status === 'Completed' ? undefined : paid,
      status,
    };
    dbSales.update(orderNo, {
      lines: updated.lines,
      total_minor: updated.totalMinor,
      tenders: updated.tenders,
      change_minor: updated.changeMinor,
      status: updated.status,
      ...(hasPaidColumns ? { paid_minor: updated.paidMinor ?? null } : {}),
    });
    set({
      lines: [],
      orderDiscountBps: 0,
      orderDiscountMinor: 0,
      taxRemoved: false,
      promoCode: '',
      openSaleNumber: null,
      customerName: '',
      orderNote: '',
      fulfillment: null,
      customFields: {},
      pendingSerial: null,
      pendingTenders: [],
      paying: false,
      lastSale: updated,
      sales: state.sales.map((s) => (s.orderNumber === orderNo ? updated : s)),
    });
    return updated;
  },

  markReturned: (orderNo) => {
    const sale = get().sales.find((s) => s.orderNumber === orderNo);
    if (!sale || sale.status === 'Returned') return;
    const items = sale.lines.map((l, index) => ({ index, quantity: l.quantity - returnedQty(sale, index) })).filter((it) => it.quantity > 0);
    get().returnItems(orderNo, items, refundFor(sale, refundAmountFor(sale, items)));
  },

  dismissLastSale: () => set({ lastSale: null, lastSaleNotices: [] }),
    }),
    {
      name: 'nova-cart-v2',
      partialize: (s) => ({ sales: s.sales, parked: s.parked, orderSeq: s.orderSeq }),
    },
  ),
);
