import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CATEGORIES } from '../data/catalog';

// Persisted catalog metadata: categories, brands and suppliers.
// Shared by the Catalog page (CRUD + filters) and the product edit modal.
export interface MetaEntity {
  id: string;
  name: string;
  description?: string;
}

interface CatalogMetaState {
  categories: MetaEntity[];
  brands: MetaEntity[];
  suppliers: MetaEntity[];
  addEntity: (kind: 'categories' | 'brands' | 'suppliers', name: string, description?: string) => void;
  updateEntity: (kind: 'categories' | 'brands' | 'suppliers', id: string, patch: Partial<MetaEntity>) => void;
  deleteEntity: (kind: 'categories' | 'brands' | 'suppliers', id: string) => void;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

export const useCatalogMeta = create<CatalogMetaState>()(
  persist(
    (set) => ({
      // Seed with the register's built-in categories so quick keys, filters and
      // the product form agree on day one.
      categories: CATEGORIES.map((c) => ({ id: c.id, name: c.name })),
      brands: [{ id: 'nova', name: 'Nova' }],
      suppliers: [{ id: 'house', name: 'House' }],
      addEntity: (kind, name, description) =>
        set((s) => ({ [kind]: [...s[kind], { id: uid(), name, description }] }) as Partial<CatalogMetaState>),
      updateEntity: (kind, id, patch) =>
        set(
          (s) =>
            ({ [kind]: s[kind].map((e) => (e.id === id ? { ...e, ...patch } : e)) }) as Partial<CatalogMetaState>,
        ),
      deleteEntity: (kind, id) =>
        set((s) => ({ [kind]: s[kind].filter((e) => e.id !== id) }) as Partial<CatalogMetaState>),
    }),
    { name: 'nova-catalog-meta-v1' },
  ),
);
