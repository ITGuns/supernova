import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

interface ProductState {
  products: Product[];
  addProduct: (p: Product) => void;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  toggleActive: (id: string) => void;
}

export const useProducts = create<ProductState>()(
  persist(
    (set) => ({
      products: [],
      addProduct: (p) => set((s) => ({ products: [p, ...s.products] })),
      updateProduct: (id, patch) =>
        set((s) => ({ products: s.products.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      deleteProduct: (id) => set((s) => ({ products: s.products.filter((x) => x.id !== id) })),
      toggleActive: (id) =>
        set((s) => ({ products: s.products.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x)) })),
    }),
    { name: 'nova-products-v2' },
  ),
);
