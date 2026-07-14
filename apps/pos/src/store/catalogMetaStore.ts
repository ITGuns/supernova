import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbCatalogMeta } from '../lib/db';
import { CATEGORIES } from '../data/catalog';

// Persisted catalog metadata: categories, brands and suppliers.
// Shared by the Catalog page (CRUD + filters) and the product edit modal.
export interface MetaEntity {
  id: string;
  name: string;
  description?: string;
}

type MetaKind = 'categories' | 'brands' | 'suppliers';

interface CatalogMetaState {
  categories: MetaEntity[];
  brands: MetaEntity[];
  suppliers: MetaEntity[];
  /** Pull all catalog_meta rows from Supabase. */
  syncFromDb: () => Promise<void>;
  addEntity: (kind: MetaKind, name: string, description?: string) => void;
  updateEntity: (kind: MetaKind, id: string, patch: Partial<MetaEntity>) => void;
  deleteEntity: (kind: MetaKind, id: string) => void;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

export const useCatalogMeta = create<CatalogMetaState>()(
  persist(
    (set, get) => ({
      categories: CATEGORIES.map((c) => ({ id: c.id, name: c.name })),
      brands: [{ id: 'nova', name: 'Nova' }],
      suppliers: [{ id: 'house', name: 'House' }],

      syncFromDb: async () => {
        const rows = await dbCatalogMeta.list();
        if (!rows.length) return;
        const categories: MetaEntity[] = [];
        const brands: MetaEntity[] = [];
        const suppliers: MetaEntity[] = [];
        for (const r of rows) {
          const entity: MetaEntity = {
            id: r.id as string,
            name: r.name as string,
            description: r.description as string | undefined,
          };
          if (r.kind === 'categories') categories.push(entity);
          else if (r.kind === 'brands') brands.push(entity);
          else suppliers.push(entity);
        }
        set({ categories, brands, suppliers });
      },

      addEntity: (kind, name, description) => {
        const entity: MetaEntity = { id: uid(), name, description };
        set((s) => ({ [kind]: [...s[kind], entity] }) as Partial<CatalogMetaState>);
        dbCatalogMeta.upsert({ id: entity.id, kind, name, description: description ?? null });
      },

      updateEntity: (kind, id, patch) => {
        const entities = get()[kind].map((e) => (e.id === id ? { ...e, ...patch } : e));
        set({ [kind]: entities } as Partial<CatalogMetaState>);
        const entity = entities.find((e) => e.id === id);
        if (entity) {
          dbCatalogMeta.upsert({ id: entity.id, kind, name: entity.name, description: entity.description ?? null });
        }
      },

      deleteEntity: (kind, id) => {
        set((s) => ({ [kind]: s[kind].filter((e) => e.id !== id) }) as Partial<CatalogMetaState>);
        dbCatalogMeta.del(id);
      },
    }),
    { name: 'nova-catalog-meta-v1' },
  ),
);
