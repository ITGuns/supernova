import { describe, expect, it } from 'vitest';
import { addMoney, allocate, applyBasisPoints, money, multiplyMoney, subtractMoney } from './money';
import { priceCart } from './pricing';
import { computeTax, type ResolvedTaxRate } from './tax';

describe('money', () => {
  it('rejects non-integer minor units', () => {
    expect(() => money(10.5, 'USD')).toThrow();
  });

  it('adds and subtracts within a currency', () => {
    expect(addMoney(money(150, 'USD'), money(99, 'USD')).amountMinor).toBe(249);
    expect(subtractMoney(money(500, 'USD'), money(150, 'USD')).amountMinor).toBe(350);
  });

  it('refuses to mix currencies', () => {
    expect(() => addMoney(money(100, 'USD'), money(100, 'EUR'))).toThrow(/Currency mismatch/);
  });

  it('multiplies by integer quantity exactly', () => {
    expect(multiplyMoney(money(199, 'USD'), 3).amountMinor).toBe(597);
  });

  it('applies basis-point rates with half-away-from-zero rounding', () => {
    // 8.25% of $10.00 = 82.5c → 83c
    expect(applyBasisPoints(money(1000, 'USD'), 825).amountMinor).toBe(83);
  });

  it('allocates with no lost or gained minor units (largest remainder)', () => {
    const parts = allocate(100, [1, 1, 1]); // 100 / 3
    expect(parts.reduce((s, p) => s + p, 0)).toBe(100);
    expect(parts).toEqual([34, 33, 33]);
  });
});

describe('priceCart', () => {
  it('computes line subtotals with no discounts', () => {
    const res = priceCart({
      channel: 'RETAIL',
      currency: 'USD',
      lines: [
        { lineId: 'a', variantId: 'v1', quantity: 2, unitPriceMinor: 500 },
        { lineId: 'b', variantId: 'v2', quantity: 1, unitPriceMinor: 300 },
      ],
    });
    expect(res.subtotalMinor).toBe(1300);
    expect(res.discountTotalMinor).toBe(0);
    expect(res.lines[0]!.lineSubtotalMinor).toBe(1000);
  });

  it('applies a line percent discount', () => {
    const res = priceCart({
      channel: 'RETAIL',
      currency: 'USD',
      lines: [{ lineId: 'a', variantId: 'v1', quantity: 1, unitPriceMinor: 1000 }],
      discounts: [{ id: 'd', name: '10% off', scope: 'LINE', method: 'PERCENT', value: 1000, lineId: 'a' }],
    });
    expect(res.lines[0]!.lineDiscountMinor).toBe(100);
    expect(res.lines[0]!.lineSubtotalMinor).toBe(900);
  });

  it('distributes an order-level discount across lines without losing cents', () => {
    const res = priceCart({
      channel: 'RETAIL',
      currency: 'USD',
      lines: [
        { lineId: 'a', variantId: 'v1', quantity: 1, unitPriceMinor: 1000 },
        { lineId: 'b', variantId: 'v2', quantity: 1, unitPriceMinor: 500 },
      ],
      discounts: [{ id: 'd', name: '$3 off order', scope: 'ORDER', method: 'FIXED_AMOUNT', value: 300 }],
    });
    const totalDiscount = res.lines.reduce((s, l) => s + l.lineDiscountMinor, 0);
    expect(totalDiscount).toBe(300);
    expect(res.discountTotalMinor).toBe(300);
  });
});

describe('computeTax', () => {
  const rate = (over: Partial<ResolvedTaxRate>): ResolvedTaxRate => ({
    taxRateId: 'r1',
    name: 'Std',
    rateBasisPoints: 1000,
    inclusive: false,
    compound: false,
    priority: 0,
    ...over,
  });

  it('adds tax on top for added-on rates', () => {
    const res = computeTax(
      [{ lineId: 'a', variantId: 'v1', quantity: 1, unitPriceMinor: 1000, lineDiscountMinor: 0, lineSubtotalMinor: 1000 }],
      () => [rate({ rateBasisPoints: 1000 })],
    );
    expect(res.taxTotalMinor).toBe(100);
  });

  it('extracts inclusive (VAT) tax without increasing the total', () => {
    const res = computeTax(
      [{ lineId: 'a', variantId: 'v1', quantity: 1, unitPriceMinor: 1200, lineDiscountMinor: 0, lineSubtotalMinor: 1200 }],
      () => [rate({ rateBasisPoints: 2000, inclusive: true })],
    );
    // 20% inclusive of 1200 → tax = 1200*2000/12000 = 200, base 1000; added-on total unaffected.
    expect(res.taxTotalMinor).toBe(0);
    expect(res.lines[0]!.snapshots[0]!.taxAmountMinor).toBe(200);
  });
});
