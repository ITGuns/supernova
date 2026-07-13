// Money — integer minor units, never floats.
// Every amount is an integer number of minor units (cents, pence, ...) paired with an ISO-4217 currency.

export type CurrencyCode = string; // ISO-4217, e.g. "USD"

export interface Money {
  readonly amountMinor: number; // integer minor units
  readonly currency: CurrencyCode;
}

export function money(amountMinor: number, currency: CurrencyCode): Money {
  if (!Number.isInteger(amountMinor)) {
    throw new Error(`Money.amountMinor must be an integer, got ${amountMinor}`);
  }
  return { amountMinor, currency };
}

export function zero(currency: CurrencyCode): Money {
  return { amountMinor: 0, currency };
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amountMinor: a.amountMinor - b.amountMinor, currency: a.currency };
}

export function sumMoney(items: readonly Money[], currency: CurrencyCode): Money {
  let total = 0;
  for (const m of items) {
    assertSameCurrency(m, { amountMinor: 0, currency });
    total += m.amountMinor;
  }
  return { amountMinor: total, currency };
}

/** Multiply money by an integer quantity (exact — no rounding needed). */
export function multiplyMoney(a: Money, qty: number): Money {
  if (!Number.isInteger(qty)) {
    throw new Error(`quantity must be an integer, got ${qty}`);
  }
  return { amountMinor: a.amountMinor * qty, currency: a.currency };
}

/** Apply a rate expressed in basis points (e.g. 825 = 8.25%), rounding half-away-from-zero. */
export function applyBasisPoints(a: Money, basisPoints: number): Money {
  const raw = (a.amountMinor * basisPoints) / 10_000;
  return { amountMinor: roundHalfAwayFromZero(raw), currency: a.currency };
}

/** Symmetric rounding so that +x and -x round to mirror magnitudes (avoids banker's-rounding surprises in tax). */
export function roundHalfAwayFromZero(n: number): number {
  return n < 0 ? -Math.round(-n) : Math.round(n);
}

export function isNegative(a: Money): boolean {
  return a.amountMinor < 0;
}

export function maxMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return a.amountMinor >= b.amountMinor ? a : b;
}

/**
 * Distribute a total across integer weights without losing or gaining a single minor unit
 * (largest-remainder / Hamilton method). Used to split order-level discounts and taxes across lines.
 */
export function allocate(total: number, weights: readonly number[]): number[] {
  if (weights.length === 0) return [];
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum <= 0) {
    throw new Error('allocate: weights must sum to a positive value');
  }
  const raw = weights.map((w) => (total * w) / sum);
  const result = raw.map((r) => Math.floor(r));
  const distributed = result.reduce((s, f) => s + f, 0);
  let remainder = total - distributed;

  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);

  let k = 0;
  while (remainder > 0 && order.length > 0) {
    const idx = order[k % order.length]!.i;
    result[idx] = result[idx]! + 1;
    remainder -= 1;
    k += 1;
  }
  return result;
}

/** Human-readable formatting. Assumes a 2-digit minor unit (extend per-currency exponent later). */
export function formatMoney(m: Money, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: m.currency }).format(
    m.amountMinor / 100,
  );
}
