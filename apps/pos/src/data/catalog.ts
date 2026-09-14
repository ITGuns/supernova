// Catalog domain types shared by the register, product store and reports.
// Prices are integer minor units (cents). taxGroupId drives the tax engine.

export type TaxGroupId = 'standard' | 'food' | 'exempt';

export interface Category {
  id: string;
  name: string;
}

export interface CatalogItem {
  id: string; // variant id
  productId: string;
  name: string;
  categoryId: string;
  priceMinor: number;
  taxGroupId: TaxGroupId;
  sku: string;
  emoji: string;
}

// Per-group fallback used only when no store-wide rate is supplied to
// computeTotals. Rates live in Setup → Sales taxes, so these stay at 0% —
// a tax must never come from a code constant.
export const TAX_RATES: Record<TaxGroupId, { name: string; rateBasisPoints: number }> = {
  standard: { name: 'Sales Tax', rateBasisPoints: 0 },
  food: { name: 'Food', rateBasisPoints: 0 },
  exempt: { name: 'Non-taxable', rateBasisPoints: 0 },
};
