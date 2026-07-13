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

export interface CartTotals {
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  itemCount: number;
  pricedLines: readonly PricedLine[];
}

export function computeTotals(
  lines: CartLine[],
  discountBps = 0,
  currency = 'USD',
  // Store-wide default sales tax rate (basis points). When provided it overrides
  // each product's tax group — this is what the "Default sales tax" setting drives.
  taxRateBpsOverride?: number,
): CartTotals {
  const discounts: AppliedDiscountInput[] =
    discountBps > 0
      ? [
          {
            id: 'order-disc',
            name: `Discount ${discountBps / 100}%`,
            scope: 'ORDER',
            method: 'PERCENT',
            value: discountBps,
          },
        ]
      : [];

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

  const tax = computeTax(priced.lines, (line): ResolvedTaxRate[] => {
    // Store-wide default tax setting wins when provided; otherwise fall back to
    // the product's own tax group.
    let rateBasisPoints: number;
    let name: string;
    let rateId: string;
    if (taxRateBpsOverride !== undefined) {
      rateBasisPoints = taxRateBpsOverride;
      name = 'Sales Tax';
      rateId = 'store-default';
    } else {
      const groupId = line.taxGroupId as TaxGroupId | null | undefined;
      const cfg = groupId ? TAX_RATES[groupId] : undefined;
      if (!cfg) return [];
      rateBasisPoints = cfg.rateBasisPoints;
      name = cfg.name;
      rateId = groupId as string;
    }
    if (rateBasisPoints === 0) return [];
    return [
      {
        taxRateId: rateId,
        name,
        rateBasisPoints,
        inclusive: false,
        compound: false,
        priority: 0,
      },
    ];
  });

  const subtotalMinor = priced.subtotalMinor;
  const discountMinor = priced.discountTotalMinor;
  const taxMinor = tax.taxTotalMinor;
  const totalMinor = subtotalMinor - discountMinor + taxMinor;
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);

  return { subtotalMinor, discountMinor, taxMinor, totalMinor, itemCount, pricedLines: priced.lines };
}
