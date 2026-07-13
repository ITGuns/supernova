// Pricing engine — the ONE ordered pipeline that serves all three channels.
// Resolution order (see docs/architecture.md §3): (1) PriceBook → (2) PricingRule → (3) Discount → (4) Tax.
// This module owns steps 1–3; tax is applied by ./tax.ts on the discounted taxable base.
//
// Phase 0: interfaces + a correct baseline (price-book list price + manual line/order discounts).
// Phase 1 fills in automatic PricingRule promotions (BOGO, qty breaks, bundles).

import { type CurrencyCode } from './money';

export type Channel = 'RETAIL' | 'RESTAURANT' | 'ECOM';
export type DiscountMethod = 'PERCENT' | 'FIXED_AMOUNT' | 'PRICE_OVERRIDE';
export type DiscountScope = 'ORDER' | 'LINE';

/** A line as handed to the engine (identifiers + quantity + resolved base price). */
export interface PricingLineInput {
  readonly lineId: string;
  readonly variantId: string | null;
  readonly quantity: number;
  /** List price for one unit before any discount, already resolved from the applicable price book. */
  readonly unitPriceMinor: number;
  readonly taxGroupId?: string | null;
}

export interface AppliedDiscountInput {
  readonly id: string;
  readonly name: string;
  readonly scope: DiscountScope;
  readonly method: DiscountMethod;
  /** PERCENT → basis points (825 = 8.25%); FIXED_AMOUNT / PRICE_OVERRIDE → minor units. */
  readonly value: number;
  /** For LINE-scoped discounts, which line it targets. */
  readonly lineId?: string;
}

export interface PricingContext {
  readonly channel: Channel;
  readonly currency: CurrencyCode;
  readonly lines: readonly PricingLineInput[];
  readonly discounts?: readonly AppliedDiscountInput[];
}

export interface PricedLine {
  readonly lineId: string;
  readonly variantId: string | null;
  readonly quantity: number;
  readonly unitPriceMinor: number;
  readonly lineDiscountMinor: number;
  /** (unitPrice * qty) - lineDiscount, pre-tax. */
  readonly lineSubtotalMinor: number;
  readonly taxGroupId?: string | null;
}

export interface PricedResult {
  readonly currency: CurrencyCode;
  readonly lines: readonly PricedLine[];
  readonly subtotalMinor: number; // Σ lineSubtotal before order-level discount
  readonly discountTotalMinor: number; // line + order discounts
}

import { allocate, roundHalfAwayFromZero } from './money';

function discountAmountForBase(baseMinor: number, d: AppliedDiscountInput): number {
  switch (d.method) {
    case 'PERCENT':
      return roundHalfAwayFromZero((baseMinor * d.value) / 10_000);
    case 'FIXED_AMOUNT':
      return Math.min(d.value, baseMinor);
    case 'PRICE_OVERRIDE':
      return Math.max(0, baseMinor - d.value);
    default:
      return 0;
  }
}

/**
 * Price the cart: apply line-level discounts, then distribute order-level discounts across
 * lines by subtotal weight (so per-line tax bases stay exact). Pure and deterministic.
 */
export function priceCart(ctx: PricingContext): PricedResult {
  const discounts = ctx.discounts ?? [];

  // Step A: gross line subtotals and line-scoped discounts.
  const working = ctx.lines.map((line) => {
    const gross = line.unitPriceMinor * line.quantity;
    const lineDiscounts = discounts.filter((d) => d.scope === 'LINE' && d.lineId === line.lineId);
    let lineDiscount = 0;
    for (const d of lineDiscounts) {
      lineDiscount += discountAmountForBase(gross - lineDiscount, d);
    }
    lineDiscount = Math.min(lineDiscount, gross);
    return { line, gross, lineDiscount, afterLine: gross - lineDiscount };
  });

  // Step B: order-level discounts, allocated across lines by post-line-discount weight.
  const orderDiscounts = discounts.filter((d) => d.scope === 'ORDER');
  const afterLineSubtotal = working.reduce((s, w) => s + w.afterLine, 0);
  let orderDiscountTotal = 0;
  for (const d of orderDiscounts) {
    orderDiscountTotal += discountAmountForBase(afterLineSubtotal - orderDiscountTotal, d);
  }
  orderDiscountTotal = Math.min(orderDiscountTotal, afterLineSubtotal);

  const weights = working.map((w) => w.afterLine);
  const allocated =
    orderDiscountTotal > 0 && afterLineSubtotal > 0
      ? allocate(orderDiscountTotal, weights)
      : working.map(() => 0);

  const lines: PricedLine[] = working.map((w, i) => {
    const orderShare = allocated[i] ?? 0;
    const lineDiscountMinor = w.lineDiscount + orderShare;
    return {
      lineId: w.line.lineId,
      variantId: w.line.variantId,
      quantity: w.line.quantity,
      unitPriceMinor: w.line.unitPriceMinor,
      lineDiscountMinor,
      lineSubtotalMinor: w.gross - lineDiscountMinor,
      taxGroupId: w.line.taxGroupId ?? null,
    };
  });

  const subtotalMinor = working.reduce((s, w) => s + w.gross, 0);
  const discountTotalMinor = working.reduce((s, w) => s + w.lineDiscount, 0) + orderDiscountTotal;

  return { currency: ctx.currency, lines, subtotalMinor, discountTotalMinor };
}
