import { create } from 'zustand';
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

/** The price after a promotion, never below zero. */
export const promoPrice = (p: Promotion, priceMinor: number): number =>
  p.kind === 'percent'
    ? Math.max(0, Math.round(priceMinor * (1 - Math.min(10000, p.value) / 10000)))
    : p.kind === 'amount'
    ? Math.max(0, priceMinor - p.value)
    : Math.max(0, p.value);

/** Human label: "10% off", "$5.00 off", "$19.99 fixed price". */
export const promoLabel = (p: Promotion): string =>
  p.kind === 'percent'
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
    if (promotionStatus(p, now) !== 'Active' || !recurringOn(p, now) || !promotionApplies(p, product, categories, ctx)) continue;
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
// Whether the table has the targeting / schedule columns (migration 0009).
let hasTargeting = true;

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
        const probe = await dbPromotions.hasTargeting();
        if (probe !== null) hasTargeting = probe;
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
