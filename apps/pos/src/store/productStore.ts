import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbProducts } from '../lib/db';
import { type CatalogItem } from '../data/catalog';

// The single source of truth for products, shared across the Products page,
// the Sell register (quick keys), and the inventory report.
// A fresh account starts empty — products are added via the Products page.

export type ProductType = 'standard' | 'variant' | 'composite';
export type SkuCodeType = 'auto' | 'custom' | 'upc' | 'ean' | 'manufacturer';
export type ReplenishMethod = 'minmax' | 'reorder';

export interface SkuCode { type: SkuCodeType; code: string }
export interface ProductSupplier { supplier: string; code: string; priceMinor: number }
/** A reference to another product with a quantity (components, packaging). */
export interface ProductRef { productId: string; quantity: number }
export interface ProductAttribute { name: string; value: string }
export interface ProductShipping { weightG: number; lengthCm: number; widthCm: number; heightCm: number; notes: string }

export interface Product extends CatalogItem {
  enabled: boolean;
  created: string;
  variants: number;
  available: number;
  brand: string;
  supplier: string;
  image?: string; // primary image as a data URL (first of `images`)

  // Full product profile (all optional so older records and quick-adds
  // stay valid; the editor fills them in).
  description?: string;
  tags?: string[];
  sellOnPos?: boolean;
  productType?: ProductType;
  /** For a variant: the attribute values that identify it, e.g. Size = M. */
  attributes?: ProductAttribute[];
  skuCodes?: SkuCode[];
  suppliers?: ProductSupplier[];
  /** Tax option id from Setup → Sales taxes; '' = store default. */
  taxId?: string;
  supplierPriceMinor?: number;
  trackInventory?: boolean;
  replenishMethod?: ReplenishMethod;
  minQty?: number | null;
  maxQty?: number | null;
  reorderPoint?: number | null;
  reorderQty?: number | null;
  location?: string;
  /** Composite: what one unit is made of. */
  components?: ProductRef[];
  comesFrom?: ProductRef[];
  breaksInto?: ProductRef[];
  images?: string[];
  shipping?: ProductShipping;
}

export const EMPTY_SHIPPING: ProductShipping = { weightG: 0, lengthCm: 0, widthCm: 0, heightCm: 0, notes: '' };

/**
 * Sellable quantity. A composite has no stock of its own: it's limited by
 * whichever component runs out first.
 */
export const availableOf = (p: Product, all: Product[]): number => {
  if (p.productType !== 'composite' || !p.components?.length) return p.available;
  return Math.min(
    ...p.components.map((c) => {
      const comp = all.find((x) => x.id === c.productId);
      return comp ? Math.floor(comp.available / Math.max(1, c.quantity)) : 0;
    }),
  );
};

/** The stock rows a sale of `qty` units actually consumes (components for a composite). */
export const stockLinesFor = (p: Product, qty: number): { id: string; delta: number }[] =>
  p.productType === 'composite' && p.components?.length
    ? p.components.map((c) => ({ id: c.productId, delta: -c.quantity * qty }))
    : [{ id: p.id, delta: -qty }];

// Whether the cloud `products` table has the profile columns from migration
// 0005. Detected from the first synced row so a write never sends columns an
// older schema would reject.
let hasDetailColumns = true;

const toRow = (p: Product): Record<string, unknown> => ({
  id: p.id,
  product_id: p.productId,
  name: p.name,
  category_id: p.categoryId,
  price_minor: p.priceMinor,
  tax_group_id: p.taxGroupId,
  sku: p.sku,
  emoji: p.emoji,
  enabled: p.enabled,
  variants: p.variants,
  available: p.available,
  brand: p.brand,
  supplier: p.supplier,
  image: p.image ?? null,
  ...(hasDetailColumns
    ? {
        description: p.description ?? '',
        tags: p.tags ?? [],
        sell_on_pos: p.sellOnPos ?? true,
        product_type: p.productType ?? 'standard',
        attributes: p.attributes ?? [],
        sku_codes: p.skuCodes ?? [],
        suppliers: p.suppliers ?? [],
        tax_id: p.taxId ?? '',
        supplier_price_minor: p.supplierPriceMinor ?? 0,
        track_inventory: p.trackInventory ?? true,
        replenish_method: p.replenishMethod ?? 'minmax',
        min_qty: p.minQty ?? null,
        max_qty: p.maxQty ?? null,
        reorder_point: p.reorderPoint ?? null,
        reorder_qty: p.reorderQty ?? null,
        location: p.location ?? '',
        components: p.components ?? [],
        comes_from: p.comesFrom ?? [],
        breaks_into: p.breaksInto ?? [],
        images: p.images ?? [],
        shipping: p.shipping ?? EMPTY_SHIPPING,
      }
    : {}),
});

const fromRow = (r: Record<string, unknown>): Product => ({
  id: r.id as string,
  productId: r.product_id as string,
  name: r.name as string,
  categoryId: r.category_id as string,
  priceMinor: r.price_minor as number,
  taxGroupId: r.tax_group_id as Product['taxGroupId'],
  sku: r.sku as string,
  emoji: r.emoji as string,
  enabled: r.enabled as boolean,
  created: r.created_at as string,
  variants: r.variants as number,
  available: r.available as number,
  brand: r.brand as string,
  supplier: r.supplier as string,
  image: (r.image as string | null) ?? undefined,
  description: (r.description as string | null) ?? '',
  tags: (r.tags as string[] | null) ?? [],
  sellOnPos: (r.sell_on_pos as boolean | null) ?? true,
  productType: (r.product_type as ProductType | null) ?? 'standard',
  attributes: (r.attributes as ProductAttribute[] | null) ?? [],
  skuCodes: (r.sku_codes as SkuCode[] | null) ?? [],
  suppliers: (r.suppliers as ProductSupplier[] | null) ?? [],
  taxId: (r.tax_id as string | null) ?? '',
  supplierPriceMinor: (r.supplier_price_minor as number | null) ?? 0,
  trackInventory: (r.track_inventory as boolean | null) ?? true,
  replenishMethod: (r.replenish_method as ReplenishMethod | null) ?? 'minmax',
  minQty: (r.min_qty as number | null) ?? null,
  maxQty: (r.max_qty as number | null) ?? null,
  reorderPoint: (r.reorder_point as number | null) ?? null,
  reorderQty: (r.reorder_qty as number | null) ?? null,
  location: (r.location as string | null) ?? '',
  components: (r.components as ProductRef[] | null) ?? [],
  comesFrom: (r.comes_from as ProductRef[] | null) ?? [],
  breaksInto: (r.breaks_into as ProductRef[] | null) ?? [],
  images: (r.images as string[] | null) ?? [],
  shipping: { ...EMPTY_SHIPPING, ...((r.shipping as Partial<ProductShipping> | null) ?? {}) },
});

interface ProductState {
  products: Product[];
  /** Pull products from Supabase and replace local state. */
  syncFromDb: () => Promise<void>;
  addProduct: (p: Product) => void;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  /** Change stock by a delta, reading the current value at call time. */
  adjustStock: (id: string, delta: number) => void;
  deleteProduct: (id: string) => void;
  toggleActive: (id: string) => void;
}

export const useProducts = create<ProductState>()(
  persist(
    (set, get) => ({
      products: [],

      syncFromDb: async () => {
        const rows = await dbProducts.list();
        if (!rows) return; // request failed — keep the cached catalog
        const probe = await dbProducts.hasDetailColumns();
        if (probe !== null) hasDetailColumns = probe;
        set({ products: rows.map(fromRow) }); // [] is a real answer: no products
      },

      addProduct: (p) => {
        set((s) => ({ products: [p, ...s.products] }));
        dbProducts.upsert(toRow(p));
      },

      updateProduct: (id, patch) => {
        const products = get().products.map((x) => (x.id === id ? { ...x, ...patch } : x));
        set({ products });
        const p = products.find((x) => x.id === id);
        if (p) dbProducts.upsert(toRow(p));
      },

      adjustStock: (id, delta) => {
        const cur = get().products.find((x) => x.id === id);
        if (cur) get().updateProduct(id, { available: Math.max(0, cur.available + delta) });
      },

      deleteProduct: (id) => {
        set((s) => ({ products: s.products.filter((x) => x.id !== id) }));
        dbProducts.del(id);
      },

      toggleActive: (id) => {
        const products = get().products.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x));
        set({ products });
        const p = products.find((x) => x.id === id);
        if (p) dbProducts.upsert(toRow(p));
      },
    }),
    { name: 'nova-products-v2' },
  ),
);
