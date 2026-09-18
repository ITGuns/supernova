import { create } from 'zustand';
import { useProducts } from './productStore';
import { useCatalogMeta } from './catalogMetaStore';
import { persist } from 'zustand/middleware';
import { dbPromotions } from '../lib/db';
import { categoryDescendantIds, type MetaEntity } from './catalogMetaStore';

// Promotions (Catalog → Promotions): an automatic discount on matching
// products while the promotion is active. The register applies the best one
// when a product is added to the sale.

export type PromotionKind = 'percent' | 'amount' | 'fixed';
export type PromotionScope = 'all' | 'categories' | 'products';
/** Who can get it: everyone, a customer group, or whoever enters the promo code. */
export type PromotionTarget = 'everyone' | 'group' | 'code';

export interface PromotionSchedule {
  kind: 'once' | 'recurring';
  /** Recurring: days of the week, 0 = Sunday. */
  days: number[];
  allDay: boolean;
  /** "HH:MM" when not all day. */
  from: string;
  to: string;
}

export const DEFAULT_SCHEDULE: PromotionSchedule = { kind: 'once', days: [1, 2, 3, 4, 5, 6, 0], allDay: true, from: '09:00', to: '17:00' };

/**
 * Advanced promotions: "buy X get Y" (buy N eligible units, get M units free
 * or discounted) or "spend X get Y" (spend $N, get % or $ off the sale).
 */
export interface AdvancedPromotion {
  trigger: 'quantity' | 'spend';
  /** Units to buy (quantity trigger) or dollars to spend in minor units (spend trigger). */
  triggerValue: number;
  /** Which products count toward the trigger. */
  triggerScope: PromotionScope;
  triggerIds: string[];
  reward: 'free' | 'percent' | 'amount';
  /** Percent in basis points, or an amount in minor units (free ignores it). */
  rewardValue: number;
  /** Units rewarded (quantity trigger). */
  rewardQty: number;
  /** Which products the reward applies to ('same' = the trigger products). */
  rewardScope: 'same' | PromotionScope;
  rewardIds: string[];
  /** Whether the reward repeats for every N units / every $N. */
  repeat: boolean;
}

export const DEFAULT_ADVANCED: AdvancedPromotion = { trigger: 'quantity', triggerValue: 2, triggerScope: 'all', triggerIds: [], reward: 'free', rewardValue: 0, rewardQty: 1, rewardScope: 'same', rewardIds: [], repeat: true };

export interface Promotion {
  id: string;
  name: string;
  description: string;
  kind: PromotionKind;
  /** percent: basis points (1050 = 10.5% off); amount: minor units off; fixed: the sale price in minor units. */
  value: number;
  appliesTo: PromotionScope;
  /** Category ids or product ids, per appliesTo. */
  targetIds: string[];
  startAt: number | null;
  endAt: number | null;
  active: boolean;
  createdAt: number;
  target: PromotionTarget;
  customerGroups: string[];
  promoCode: string;
  /** Outlet names; empty = all outlets. */
  outlets: string[];
  schedule: PromotionSchedule;
  earnLoyalty: boolean;
  /** Present for advanced (buy X get Y / spend X) promotions; basic ones leave it undefined. */
  advanced?: AdvancedPromotion;
}

export type PromotionStatus = 'Active' | 'Scheduled' | 'Expired' | 'Inactive';

/** Whether a recurring promotion runs at this moment (day of week + hours). */
const recurringOn = (p: Promotion, now: number): boolean => {
  if (p.schedule.kind !== 'recurring') return true;
  const d = new Date(now);
  if (!p.schedule.days.includes(d.getDay())) return false;
  if (p.schedule.allDay) return true;
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return hm >= p.schedule.from && hm <= p.schedule.to;
};

export const promotionStatus = (p: Promotion, now = Date.now()): PromotionStatus =>
  !p.active ? 'Inactive' : p.startAt !== null && p.startAt > now ? 'Scheduled' : p.endAt !== null && p.endAt < now ? 'Expired' : 'Active';

export interface PromotionContext {
  /** The attached customer's group, if any. */
  group?: string | null;
  /** Promo code typed on the sale. */
  promoCode?: string;
  outlet?: string;
}

export const promotionApplies = (
  p: Promotion,
  product: { id: string; productId?: string; categoryId: string },
  categories: MetaEntity[],
  ctx: PromotionContext = {},
): boolean => {
  if (p.target === 'group' && !(ctx.group && p.customerGroups.includes(ctx.group))) return false;
  if (p.target === 'code' && !(ctx.promoCode && p.promoCode && ctx.promoCode.toUpperCase() === p.promoCode.toUpperCase())) return false;
  if (p.outlets.length && ctx.outlet && !p.outlets.includes(ctx.outlet)) return false;
  return p.appliesTo === 'all'
    ? true
    : p.appliesTo === 'products'
    ? p.targetIds.includes(product.id) || (!!product.productId && p.targetIds.includes(product.productId))
    : p.targetIds.some((c) => categoryDescendantIds(categories, c).has(product.categoryId));
};

/** Human label for an advanced promotion, e.g. "Buy 2 get 1 free" or "Spend $50 get 10% off". */
export const advancedLabel = (a: AdvancedPromotion): string => {
  const reward = a.reward === 'free' ? `${a.rewardQty} free` : a.reward === 'percent' ? `${(a.rewardValue / 100).toFixed(2).replace(/\.?0+$/, '')}% off` : `$${(a.rewardValue / 100).toFixed(2)} off`;
  return a.trigger === 'quantity' ? `Buy ${a.triggerValue} get ${reward}` : `Spend $${(a.triggerValue / 100).toFixed(2)} get ${reward}`;
};

const inScope = (scope: PromotionScope, ids: string[], product: { id: string; productId?: string; categoryId: string }, categories: MetaEntity[]): boolean =>
  scope === 'all' ? true : scope === 'products' ? ids.includes(product.id) || (!!product.productId && ids.includes(product.productId)) : ids.some((c) => categoryDescendantIds(categories, c).has(product.categoryId));

/**
 * Sale-wide discounts from advanced promotions for the lines on the register.
 * Buy X get Y: every N eligible units earn M reward units (the cheapest
 * eligible ones) free or discounted. Spend X: once the eligible lines reach
 * the threshold, the reward comes off the sale.
 */
export const advancedDiscounts = (
  lines: { variantId: string; unitPriceMinor: number; quantity: number; discountPct?: number; custom?: boolean }[],
  ctx: PromotionContext,
  now = Date.now(),
): { promotionId: string; name: string; amountMinor: number }[] => {
  const promotions = usePromotions.getState().promotions;
  const products = useProducts.getState().products;
  const categories = useCatalogMeta.getState().categories;
  const out: { promotionId: string; name: string; amountMinor: number }[] = [];
  for (const p of promotions) {
    const a = p.advanced;
    if (!a || promotionStatus(p, now) !== 'Active' || !recurringOn(p, now)) continue;
    if (p.target === 'group' && !(ctx.group && p.customerGroups.includes(ctx.group))) continue;
    if (p.target === 'code' && !(ctx.promoCode && p.promoCode && ctx.promoCode.toUpperCase() === p.promoCode.toUpperCase())) continue;
    // Units on the sale, expanded one per unit with their net price, cheapest first.
    const units: { price: number; product: { id: string; productId?: string; categoryId: string } }[] = [];
    for (const l of lines) {
      if (l.custom) continue;
      const product = products.find((x) => x.id === l.variantId);
      if (!product) continue;
      const price = Math.round(l.unitPriceMinor * (1 - (l.discountPct ?? 0) / 100));
      for (let i = 0; i < l.quantity; i++) units.push({ price, product });
    }
    const triggerUnits = units.filter((u) => inScope(a.triggerScope, a.triggerIds, u.product, categories));
    let amount = 0;
    if (a.trigger === 'quantity') {
      const need = Math.max(1, a.triggerValue);
      const sets = Math.floor(triggerUnits.length / need);
      const times = a.repeat ? sets : Math.min(1, sets);
      if (times === 0) continue;
      const rewardPool = (a.rewardScope === 'same' ? triggerUnits : units.filter((u) => inScope(a.rewardScope as PromotionScope, a.rewardIds, u.product, categories))).map((u) => u.price).sort((x, y) => x - y);
      const rewardUnits = rewardPool.slice(0, Math.max(0, times * Math.max(1, a.rewardQty)));
      for (const price of rewardUnits) amount += a.reward === 'free' ? price : a.reward === 'percent' ? Math.round((price * Math.min(10000, a.rewardValue)) / 10000) : Math.min(price, a.rewardValue);
    } else {
      const spend = triggerUnits.reduce((s, u) => s + u.price, 0);
      const threshold = Math.max(1, a.triggerValue);
      const times = a.repeat ? Math.floor(spend / threshold) : spend >= threshold ? 1 : 0;
      if (times === 0) continue;
      amount = a.reward === 'percent' ? Math.round((spend * Math.min(10000, a.rewardValue)) / 10000) : a.reward === 'amount' ? Math.min(spend, a.rewardValue * times) : 0;
    }
    if (amount > 0) out.push({ promotionId: p.id, name: `${p.name} · ${advancedLabel(a)}`, amountMinor: amount });
  }
  return out;
};

/** The price after a promotion, never below zero. */
export const promoPrice = (p: Promotion, priceMinor: number): number =>
  p.kind === 'percent'
    ? Math.max(0, Math.round(priceMinor * (1 - Math.min(10000, p.value) / 10000)))
    : p.kind === 'amount'
    ? Math.max(0, priceMinor - p.value)
    : Math.max(0, p.value);

/** Human label: "10% off", "$5.00 off", "$19.99 fixed price", "Buy 2 get 1 free". */
export const promoLabel = (p: Promotion): string =>
  p.advanced
    ? advancedLabel(p.advanced)
    : p.kind === 'percent'
    ? `${(p.value / 100).toFixed(2).replace(/\.?0+$/, '')}% off`
    : p.kind === 'amount'
    ? `$${(p.value / 100).toFixed(2)} off`
    : `$${(p.value / 100).toFixed(2)} fixed price`;

/** The promotion giving the lowest price for a product right now, if any. */
export const bestPromotion = (
  product: { id: string; productId?: string; categoryId: string },
  priceMinor: number,
  promotions: Promotion[],
  categories: MetaEntity[],
  ctx: PromotionContext = {},
  now = Date.now(),
): { promotion: Promotion; priceMinor: number } | null => {
  let best: { promotion: Promotion; priceMinor: number } | null = null;
  for (const p of promotions) {
    if (p.advanced || promotionStatus(p, now) !== 'Active' || !recurringOn(p, now) || !promotionApplies(p, product, categories, ctx)) continue;
    const price = promoPrice(p, priceMinor);
    if (price < priceMinor && (!best || price < best.priceMinor)) best = { promotion: p, priceMinor: price };
  }
  return best;
};

interface PromotionState {
  promotions: Promotion[];
  syncFromDb: () => Promise<void>;
  addPromotion: (p: Omit<Promotion, 'id' | 'createdAt'>) => Promotion;
  updatePromotion: (id: string, patch: Partial<Promotion>) => void;
  deletePromotion: (id: string) => void;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

let hasTable = true;
// Whether the table has the targeting / schedule columns (migration 0009) / advanced (0011).
let hasTargeting = true;
let hasAdvanced = true;

const toRow = (p: Promotion): Record<string, unknown> => ({
  id: p.id,
  name: p.name,
  description: p.description,
  kind: p.kind,
  value: p.value,
  applies_to: p.appliesTo,
  target_ids: p.targetIds,
  start_at: p.startAt ? new Date(p.startAt).toISOString() : null,
  end_at: p.endAt ? new Date(p.endAt).toISOString() : null,
  active: p.active,
  created_at: new Date(p.createdAt).toISOString(),
  ...(hasTargeting
    ? { target: p.target, customer_groups: p.customerGroups, promo_code: p.promoCode, outlets: p.outlets, schedule: p.schedule, earn_loyalty: p.earnLoyalty }
    : {}),
  ...(hasAdvanced ? { advanced: p.advanced ?? null } : {}),
});

const fromRow = (r: Record<string, unknown>): Promotion => ({
  id: r.id as string,
  name: r.name as string,
  description: (r.description as string | null) ?? '',
  kind: (r.kind as PromotionKind) ?? 'percent',
  value: (r.value as number | null) ?? 0,
  appliesTo: (r.applies_to as PromotionScope) ?? 'all',
  targetIds: (r.target_ids as string[] | null) ?? [],
  startAt: r.start_at ? new Date(r.start_at as string).getTime() : null,
  endAt: r.end_at ? new Date(r.end_at as string).getTime() : null,
  active: r.active !== false,
  createdAt: new Date(r.created_at as string).getTime(),
  target: (r.target as PromotionTarget) ?? 'everyone',
  customerGroups: (r.customer_groups as string[] | null) ?? [],
  promoCode: (r.promo_code as string | null) ?? '',
  outlets: (r.outlets as string[] | null) ?? [],
  schedule: { ...DEFAULT_SCHEDULE, ...((r.schedule as Partial<PromotionSchedule> | null) ?? {}) },
  earnLoyalty: r.earn_loyalty !== false,
  advanced: r.advanced ? { ...DEFAULT_ADVANCED, ...(r.advanced as Partial<AdvancedPromotion>) } : undefined,
});

export const usePromotions = create<PromotionState>()(
  persist(
    (set, get) => ({
      promotions: [],

      syncFromDb: async () => {
        const rows = await dbPromotions.list();
        if (rows === null) return;
        if (rows === 'missing') {
          hasTable = false;
          return;
        }
        hasTable = true;
        const [probe, advProbe] = await Promise.all([dbPromotions.hasTargeting(), dbPromotions.hasAdvanced()]);
        if (probe !== null) hasTargeting = probe;
        if (advProbe !== null) hasAdvanced = advProbe;
        set({ promotions: rows.map(fromRow) });
      },

      addPromotion: (p) => {
        const created: Promotion = { ...p, id: uid(), createdAt: Date.now() };
        set((s) => ({ promotions: [created, ...s.promotions] }));
        if (hasTable) dbPromotions.upsert(toRow(created));
        return created;
      },

      updatePromotion: (id, patch) => {
        const promotions = get().promotions.map((p) => (p.id === id ? { ...p, ...patch } : p));
        set({ promotions });
        const p = promotions.find((x) => x.id === id);
        if (p && hasTable) dbPromotions.upsert(toRow(p));
      },

      deletePromotion: (id) => {
        set((s) => ({ promotions: s.promotions.filter((p) => p.id !== id) }));
        if (hasTable) dbPromotions.del(id);
      },
    }),
    { name: 'nova-promotions-v1' },
  ),
);
