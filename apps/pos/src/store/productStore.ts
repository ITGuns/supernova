import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbProducts } from '../lib/db';
import { type CatalogItem } from '../data/catalog';

// The single source of truth for products, shared across the Products page,
// the Sell register (quick keys), and the inventory report.
// A fresh account starts empty — products are added via the Products page.
export interface Product extends CatalogItem {
  enabled: boolean;
  created: string;
  variants: number;
  available: number;
  brand: string;
  supplier: string;
  image?: string; // uploaded product image as a data URL
}

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
  image: r.image as string | undefined,
});

interface ProductState {
  products: Product[];
  /** Pull products from Supabase and replace local state. */
  syncFromDb: () => Promise<void>;
  addProduct: (p: Product) => void;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  toggleActive: (id: string) => void;
}

export const useProducts = create<ProductState>()(
  persist(
    (set, get) => ({
      products: [],

      syncFromDb: async () => {
        const rows = await dbProducts.list();
        if (!rows.length) return;
        set({ products: rows.map(fromRow) });
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
