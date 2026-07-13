// Tax engine — computes line-level tax on the discounted taxable base (step 4 of the pricing pipeline).
// Resolves rates per (jurisdiction × product tax group), supports added-on and price-inclusive (VAT)
// rates and compounding, and returns immutable per-line-per-rate snapshots to persist as OrderTaxLine.
//
// Phase 0: correct math for added-on, inclusive, and compound rates given already-resolved rates.
// Phase 1 adds the resolution layer (store → jurisdiction chain × taxGroup → rates, minus exemptions).

import { roundHalfAwayFromZero } from './money';
import { type PricedLine } from './pricing';

export interface ResolvedTaxRate {
  readonly taxRateId: string;
  readonly name: string; // snapshot, e.g. "CA State 8.25%"
  readonly rateBasisPoints: number; // 825 = 8.25%
  readonly inclusive: boolean; // price-inclusive (VAT) vs added-on
  readonly compound: boolean; // apply on top of prior taxes
  readonly priority: number; // application order (lower first)
}

export interface LineTaxSnapshot {
  readonly lineId: string;
  readonly taxRateId: string;
  readonly taxName: string;
  readonly rateBasisPoints: number;
  readonly taxableBaseMinor: number;
  readonly taxAmountMinor: number;
  readonly inclusive: boolean;
}

export interface LineTaxResult {
  readonly lineId: string;
  readonly taxMinor: number; // Σ this line's snapshots (added-on portion)
  readonly snapshots: readonly LineTaxSnapshot[];
}

/** Resolver signature — Phase 1 implementation maps a line to its applicable rates. */
export type TaxRateResolver = (line: PricedLine) => readonly ResolvedTaxRate[];

function computeLineTax(line: PricedLine, rates: readonly ResolvedTaxRate[]): LineTaxResult {
  const ordered = [...rates].sort((a, b) => a.priority - b.priority);
  const snapshots: LineTaxSnapshot[] = [];
  let addedOnTax = 0;
  let compoundBase = line.lineSubtotalMinor;

  for (const rate of ordered) {
    if (rate.inclusive) {
      // Tax already included in the price: extract it — base = gross / (1 + r).
      const gross = line.lineSubtotalMinor;
      const taxAmount = roundHalfAwayFromZero(
        (gross * rate.rateBasisPoints) / (10_000 + rate.rateBasisPoints),
      );
      snapshots.push({
        lineId: line.lineId,
        taxRateId: rate.taxRateId,
        taxName: rate.name,
        rateBasisPoints: rate.rateBasisPoints,
        taxableBaseMinor: gross - taxAmount,
        taxAmountMinor: taxAmount,
        inclusive: true,
      });
      // Inclusive tax does not add to the total the customer pays.
      continue;
    }

    const base = rate.compound ? compoundBase : line.lineSubtotalMinor;
    const taxAmount = roundHalfAwayFromZero((base * rate.rateBasisPoints) / 10_000);
    snapshots.push({
      lineId: line.lineId,
      taxRateId: rate.taxRateId,
      taxName: rate.name,
      rateBasisPoints: rate.rateBasisPoints,
      taxableBaseMinor: base,
      taxAmountMinor: taxAmount,
      inclusive: false,
    });
    addedOnTax += taxAmount;
    compoundBase += taxAmount;
  }

  return { lineId: line.lineId, taxMinor: addedOnTax, snapshots };
}

export function computeTax(
  lines: readonly PricedLine[],
  resolve: TaxRateResolver,
): { lines: LineTaxResult[]; taxTotalMinor: number } {
  const results = lines.map((line) => computeLineTax(line, resolve(line)));
  const taxTotalMinor = results.reduce((s, r) => s + r.taxMinor, 0);
  return { lines: results, taxTotalMinor };
}
