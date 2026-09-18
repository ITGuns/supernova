// Cart totals — computed with the shared @nova/domain engine (same code that will run on the server).
import {
  computeTax,
  priceCart,
  type AppliedDiscountInput,
  type PricedLine,
  type ResolvedTaxRate,
} from '@nova/domain';
import { TAX_RATES, type TaxGroupId } from '../data/catalog';
import type { CartLine } from '../store/cartStore';
import type { ResolvedRate } from './taxes';

export interface TaxRow {
  id: string;
  name: string;
  rateBps: number;
  amountMinor: number;
}

export interface CartTotals {
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  itemCount: number;
  pricedLines: readonly PricedLine[];
  /** Tax charged, one row per rate. */
  taxRows: TaxRow[];
  /** Whether tax was carved out of the prices (tax-inclusive store) rather than added on. */
  taxInclusive: boolean;
}

/** A whole-sale discount: a percentage (basis points) or a fixed amount. */
export interface OrderDiscount {
  bps?: number;
  amountMinor?: number;
  /** Automatic (advanced promotion) discounts, applied after the manual one. */
  promotions?: { name: string; amountMinor: number }[];
}

export interface TotalsOptions {
  removeTax?: boolean;
  /** Resolve the tax rate for a line (Setup → Sales taxes). Wins over the legacy override. */
  rateFor?: (line: CartLine) => ResolvedRate | null;
  /** Prices already include tax (tax-exclusive display prices turned off). */
  inclusive?: boolean;
}

export function computeTotals(
  lines: CartLine[],
  // A plain number is a percentage in basis points (legacy callers).
  discount: number | OrderDiscount = 0,
  currency = 'USD',
  // Store-wide default sales tax rate (basis points), used when no resolver is given.
  taxRateBpsOverride?: number,
  opts: TotalsOptions = {},
): CartTotals {
  const order: OrderDiscount = typeof discount === 'number' ? { bps: discount } : discount;
  const discounts: AppliedDiscountInput[] = [];
  // Line discounts first (a percentage typed on the line itself).
  for (const l of lines) {
    if ((l.discountPct ?? 0) > 0) {
      discounts.push({
        id: `line-disc-${l.lineId}`,
        name: `${l.discountPct}% off`,
        scope: 'LINE',
        method: 'PERCENT',
        value: Math.round((l.discountPct ?? 0) * 100),
        lineId: l.lineId,
      });
    }
  }
  if ((order.bps ?? 0) > 0) {
    discounts.push({ id: 'order-disc', name: `Discount ${(order.bps ?? 0) / 100}%`, scope: 'ORDER', method: 'PERCENT', value: order.bps ?? 0 });
  } else if ((order.amountMinor ?? 0) > 0) {
    discounts.push({ id: 'order-disc', name: 'Discount', scope: 'ORDER', method: 'FIXED_AMOUNT', value: order.amountMinor ?? 0 });
  }
  (order.promotions ?? []).forEach((p, i) => {
    if (p.amountMinor > 0) discounts.push({ id: `promo-${i}`, name: p.name, scope: 'ORDER', method: 'FIXED_AMOUNT', value: p.amountMinor });
  });

  const priced = priceCart({
    channel: 'RETAIL',
    currency,
    lines: lines.map((l) => ({
      lineId: l.lineId,
      variantId: l.variantId,
      quantity: l.quantity,
      unitPriceMinor: l.unitPriceMinor,
      taxGroupId: l.taxGroupId,
    })),
    discounts,
  });

  const byLine = new Map(lines.map((l) => [l.lineId, l]));
  const inclusive = !!opts.inclusive;
  const tax = computeTax(priced.lines, (line): ResolvedTaxRate[] => {
    if (opts.removeTax) return [];
    let resolved: ResolvedRate | null;
    if (opts.rateFor) {
      const cartLine = byLine.get(line.lineId);
      resolved = cartLine ? opts.rateFor(cartLine) : null;
    } else if (taxRateBpsOverride !== undefined) {
      // Store-wide default tax setting (legacy callers without a resolver).
      resolved = { id: 'store-default', name: 'Sales Tax', rateBps: taxRateBpsOverride };
    } else {
      const groupId = line.taxGroupId as TaxGroupId | null | undefined;
      const cfg = groupId ? TAX_RATES[groupId] : undefined;
      resolved = cfg ? { id: groupId as string, name: cfg.name, rateBps: cfg.rateBasisPoints } : null;
    }
    if (!resolved || resolved.rateBps === 0) return [];
    return [{ taxRateId: resolved.id, name: resolved.name, rateBasisPoints: resolved.rateBps, inclusive, compound: false, priority: 0 }];
  });

  const rows = new Map<string, TaxRow>();
  for (const lt of tax.lines)
    for (const snap of lt.snapshots) {
      const row = rows.get(snap.taxRateId) ?? { id: snap.taxRateId, name: snap.taxName, rateBps: snap.rateBasisPoints, amountMinor: 0 };
      row.amountMinor += snap.taxAmountMinor;
      rows.set(snap.taxRateId, row);
    }
  const taxRows = [...rows.values()];

  const subtotalMinor = priced.subtotalMinor;
  const discountMinor = priced.discountTotalMinor;
  // Inclusive tax lives inside the prices, so it never adds to what the customer pays.
  const taxMinor = inclusive ? taxRows.reduce((a, r) => a + r.amountMinor, 0) : tax.taxTotalMinor;
  const totalMinor = subtotalMinor - discountMinor + (inclusive ? 0 : taxMinor);
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);

  return { subtotalMinor, discountMinor, taxMinor, totalMinor, itemCount, pricedLines: priced.lines, taxRows, taxInclusive: inclusive };
}
