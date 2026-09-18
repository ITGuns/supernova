import { useMemo } from 'react';
import { useCart, type CartLine } from '../store/cartStore';
import { useCatalogMeta } from '../store/catalogMetaStore';
import { useCustomers } from '../store/customerStore';
import { useProducts } from '../store/productStore';
import { advancedDiscounts, usePromotions } from '../store/promotionStore';
import { useRegister } from '../store/registerStore';
import { useSettings } from '../store/settingsStore';
import { useSetup } from '../store/setupStore';
import { resolveRate, type TaxDeps } from './taxes';
import { computeTotals, type CartTotals, type OrderDiscount } from './totals';

// Everything the register needs to price the sale in front of it: the
// manual discount, automatic (advanced) promotions, per-product / per-outlet
// taxes, tax-exempt customers and tax-inclusive pricing.

export interface CheckoutTotals extends CartTotals {
  /** Automatic promotion discounts applied to the sale (part of discountMinor). */
  promotions: { name: string; amountMinor: number }[];
}

export interface CheckoutOptions {
  orderDiscountBps: number;
  orderDiscountMinor: number;
  taxRemoved: boolean;
  customerName: string;
  promoCode: string;
}

/** Resolve the deps from the stores (outside React). */
export const checkoutDeps = (): { tax: TaxDeps; taxExclusive: boolean } => {
  const settings = useSettings.getState();
  const setup = useSetup.getState();
  const outletId = useRegister.getState().outletId ?? setup.outlets[0]?.id ?? '';
  return {
    tax: {
      taxes: settings.taxes,
      taxGroups: settings.taxGroups,
      outletTaxes: setup.outletTaxes,
      outletId,
      defaultTaxLabel: settings.defaultTaxLabel,
      defaultTaxRateBps: settings.defaultTaxRateBps,
    },
    taxExclusive: settings.taxExclusive,
  };
};

const customerOf = (name: string) => {
  const n = name.trim().toLowerCase();
  return n ? useCustomers.getState().customers.find((c) => `${c.firstName} ${c.lastName}`.trim().toLowerCase() === n) : undefined;
};

export function computeCheckout(lines: CartLine[], o: CheckoutOptions): CheckoutTotals {
  const deps = checkoutDeps();
  const products = useProducts.getState().products;
  const customer = customerOf(o.customerName);
  const taxDeps: TaxDeps = { ...deps.tax, customerTaxExempt: !!customer?.details?.taxExempt };
  const promotions = advancedDiscounts(lines, { group: customer?.group ?? null, promoCode: o.promoCode });
  const discount: OrderDiscount = { bps: o.orderDiscountBps, amountMinor: o.orderDiscountMinor, promotions };
  const totals = computeTotals(lines, discount, 'USD', undefined, {
    removeTax: o.taxRemoved,
    inclusive: !deps.taxExclusive,
    rateFor: (line) => {
      if (line.giftCard) return null; // gift cards are never taxed when sold
      const product = products.find((p) => p.id === line.variantId);
      return resolveRate(product?.taxId, taxDeps);
    },
  });
  return { ...totals, promotions };
}

/** The current register sale's totals, recomputed whenever anything relevant changes. */
export function useCheckout(): CheckoutTotals {
  const lines = useCart((s) => s.lines);
  const orderDiscountBps = useCart((s) => s.orderDiscountBps);
  const orderDiscountMinor = useCart((s) => s.orderDiscountMinor);
  const taxRemoved = useCart((s) => s.taxRemoved);
  const customerName = useCart((s) => s.customerName);
  const promoCode = useCart((s) => s.promoCode);
  // Subscribe to the stores the calculation reads so the totals refresh live.
  const taxes = useSettings((s) => s.taxes);
  const taxGroups = useSettings((s) => s.taxGroups);
  const taxExclusive = useSettings((s) => s.taxExclusive);
  const defaultTaxRateBps = useSettings((s) => s.defaultTaxRateBps);
  const outletTaxes = useSetup((s) => s.outletTaxes);
  const promotions = usePromotions((s) => s.promotions);
  const categories = useCatalogMeta((s) => s.categories);
  const customers = useCustomers((s) => s.customers);
  const products = useProducts((s) => s.products);
  return useMemo(
    () => computeCheckout(lines, { orderDiscountBps, orderDiscountMinor, taxRemoved, customerName, promoCode }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, orderDiscountBps, orderDiscountMinor, taxRemoved, customerName, promoCode, taxes, taxGroups, taxExclusive, defaultTaxRateBps, outletTaxes, promotions, categories, customers, products],
  );
}
