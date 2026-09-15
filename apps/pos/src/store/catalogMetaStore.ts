import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbCatalogMeta } from '../lib/db';

// Persisted catalog metadata: categories, brands and suppliers.
// Shared by the Catalog page (CRUD + filters), the product editor and the
// supplier editor.

export interface Address {
  street1: string;
  street2: string;
  suburb: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export const EMPTY_ADDRESS: Address = { street1: '', street2: '', suburb: '', city: '', state: '', zip: '', country: '' };

/** Full supplier profile, edited on /catalog/suppliers/:id. */
export interface SupplierDetails {
  /** Applied to a product's supplier price when it has no retail price yet. */
  defaultMarkupBps: number;
  contact: {
    firstName: string;
    lastName: string;
    company: string;
    email: string;
    phone: string;
    mobile: string;
    fax: string;
    website: string;
    twitter: string;
  };
  physical: Address;
  mailingSameAsStore: boolean;
  mailing: Address;
}

export const EMPTY_SUPPLIER_DETAILS: SupplierDetails = {
  defaultMarkupBps: 0,
  contact: { firstName: '', lastName: '', company: '', email: '', phone: '', mobile: '', fax: '', website: '', twitter: '' },
  physical: { ...EMPTY_ADDRESS },
  mailingSameAsStore: true,
  mailing: { ...EMPTY_ADDRESS },
};

export interface MetaEntity {
  id: string;
  name: string;
  description?: string;
  /** Suppliers only. */
  details?: SupplierDetails;
}

type MetaKind = 'categories' | 'brands' | 'suppliers';

interface CatalogMetaState {
  categories: MetaEntity[];
  brands: MetaEntity[];
  suppliers: MetaEntity[];
  /** Pull all catalog_meta rows from Supabase. */
  syncFromDb: () => Promise<void>;
  addEntity: (kind: MetaKind, name: string, description?: string, details?: SupplierDetails) => MetaEntity;
  updateEntity: (kind: MetaKind, id: string, patch: Partial<MetaEntity>) => void;
  deleteEntity: (kind: MetaKind, id: string) => void;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

// Starter set for a store with no catalog metadata in the cloud yet: one
// neutral entry of each kind so the product editor always has a default.
export const DEFAULT_CATEGORY_ID = 'general';
const DEFAULTS = {
  categories: [{ id: DEFAULT_CATEGORY_ID, name: 'General' }],
  brands: [{ id: 'unbranded', name: 'Unbranded' }],
  suppliers: [{ id: 'direct', name: 'Direct' }],
};

// Whether the cloud table has the supplier `details` column (migration 0006).
// Probed on sync so a write never sends a column an older schema would reject.
let hasDetailsColumn = true;

const toRow = (kind: MetaKind, e: MetaEntity): Record<string, unknown> => ({
  id: e.id,
  kind,
  name: e.name,
  description: e.description ?? null,
  ...(hasDetailsColumn ? { details: e.details ?? {} } : {}),
});

export const useCatalogMeta = create<CatalogMetaState>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,

      syncFromDb: async () => {
        const rows = await dbCatalogMeta.list();
        if (!rows) return; // request failed — keep whatever we have
        const probe = await dbCatalogMeta.hasDetails();
        if (probe !== null) hasDetailsColumn = probe;
        if (!rows.length) {
          // Cloud is empty (fresh or wiped store): every device shows the
          // same starter set rather than stale cached entries.
          set(DEFAULTS);
          return;
        }
        const categories: MetaEntity[] = [];
        const brands: MetaEntity[] = [];
        const suppliers: MetaEntity[] = [];
        // Collapse duplicate names within each kind so a filter dropdown never
        // shows "Seasonal" nine times if the source data ever contains dupes.
        const seen = { categories: new Set<string>(), brands: new Set<string>(), suppliers: new Set<string>() };
        for (const r of rows) {
          const details = r.details as Partial<SupplierDetails> | null | undefined;
          const entity: MetaEntity = {
            id: r.id as string,
            name: r.name as string,
            description: (r.description as string | null) ?? undefined,
            ...(r.kind === 'suppliers' && details && Object.keys(details).length
              ? { details: { ...EMPTY_SUPPLIER_DETAILS, ...details } }
              : {}),
          };
          const bucket =
            r.kind === 'categories' ? categories : r.kind === 'brands' ? brands : suppliers;
          const kindSeen = seen[r.kind as keyof typeof seen] ?? seen.categories;
          const key = entity.name.trim().toLowerCase();
          if (kindSeen.has(key)) continue;
          kindSeen.add(key);
          bucket.push(entity);
        }
        set({ categories, brands, suppliers });
      },

      addEntity: (kind, name, description, details) => {
        const entity: MetaEntity = { id: uid(), name, description, ...(details ? { details } : {}) };
        set((s) => ({ [kind]: [...s[kind], entity] }) as Partial<CatalogMetaState>);
        dbCatalogMeta.upsert(toRow(kind, entity));
        return entity;
      },

      updateEntity: (kind, id, patch) => {
        const entities = get()[kind].map((e) => (e.id === id ? { ...e, ...patch } : e));
        set({ [kind]: entities } as Partial<CatalogMetaState>);
        const entity = entities.find((e) => e.id === id);
        if (entity) dbCatalogMeta.upsert(toRow(kind, entity));
      },

      deleteEntity: (kind, id) => {
        set((s) => ({ [kind]: s[kind].filter((e) => e.id !== id) }) as Partial<CatalogMetaState>);
        dbCatalogMeta.del(id);
      },
    }),
    { name: 'nova-catalog-meta-v1' },
  ),
);
