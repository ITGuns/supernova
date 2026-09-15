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
  /** Categories only: the category one level up (up to three levels deep). */
  parentId?: string;
}

export type MetaKind = 'categories' | 'brands' | 'suppliers';

// ── Category hierarchy helpers ───────────────────────────────────────────────

/** Root → leaf chain for a category, e.g. [Clothing, Men's, Shirts]. */
export const categoryPath = (categories: MetaEntity[], id: string): MetaEntity[] => {
  const path: MetaEntity[] = [];
  let cur = categories.find((c) => c.id === id);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift(cur);
    cur = cur.parentId ? categories.find((c) => c.id === cur!.parentId) : undefined;
  }
  return path;
};

/** "Clothing / Men's / Shirts" — falls back to the raw id for a missing category. */
export const categoryLabel = (categories: MetaEntity[], id: string): string => {
  const path = categoryPath(categories, id);
  return path.length ? path.map((c) => c.name).join(' / ') : id;
};

/** A category plus everything nested under it. */
export const categoryDescendantIds = (categories: MetaEntity[], id: string): Set<string> => {
  const ids = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of categories) {
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id);
        grew = true;
      }
    }
  }
  return ids;
};

/** Categories ordered by their full label so nested ones sit under their parent. */
export const sortedCategories = (categories: MetaEntity[]): MetaEntity[] =>
  [...categories].sort((a, b) =>
    categoryLabel(categories, a.id).toLowerCase().localeCompare(categoryLabel(categories, b.id).toLowerCase()),
  );

interface CatalogMetaState {
  categories: MetaEntity[];
  brands: MetaEntity[];
  suppliers: MetaEntity[];
  /** Pull all catalog_meta rows from Supabase. */
  syncFromDb: () => Promise<void>;
  addEntity: (kind: MetaKind, name: string, description?: string, details?: SupplierDetails, parentId?: string) => MetaEntity;
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

// The `details` JSON column carries the supplier profile, or a category's
// parent link; brands don't use it.
const detailsFor = (kind: MetaKind, e: MetaEntity): object =>
  kind === 'suppliers' ? (e.details ?? {}) : kind === 'categories' ? { parentId: e.parentId ?? null } : {};

const toRow = (kind: MetaKind, e: MetaEntity): Record<string, unknown> => ({
  id: e.id,
  kind,
  name: e.name,
  description: e.description ?? null,
  ...(hasDetailsColumn ? { details: detailsFor(kind, e) } : {}),
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
        // Categories are keyed by parent + name: "Shirts" may sit under both
        // "Men's" and "Women's".
        const seen = { categories: new Set<string>(), brands: new Set<string>(), suppliers: new Set<string>() };
        for (const r of rows) {
          const details = (r.details ?? null) as Record<string, unknown> | null;
          const parentId = r.kind === 'categories' && typeof details?.parentId === 'string' ? details.parentId : undefined;
          const entity: MetaEntity = {
            id: r.id as string,
            name: r.name as string,
            description: (r.description as string | null) ?? undefined,
            ...(r.kind === 'suppliers' && details && Object.keys(details).length
              ? { details: { ...EMPTY_SUPPLIER_DETAILS, ...(details as Partial<SupplierDetails>) } }
              : {}),
            ...(parentId ? { parentId } : {}),
          };
          const bucket =
            r.kind === 'categories' ? categories : r.kind === 'brands' ? brands : suppliers;
          const kindSeen = seen[r.kind as keyof typeof seen] ?? seen.categories;
          const key = `${parentId ?? ''}/${entity.name.trim().toLowerCase()}`;
          if (kindSeen.has(key)) continue;
          kindSeen.add(key);
          bucket.push(entity);
        }
        // A parent that no longer exists makes its children top-level.
        const ids = new Set(categories.map((c) => c.id));
        for (const c of categories) if (c.parentId && !ids.has(c.parentId)) delete c.parentId;
        // A kind with no rows of its own still gets its starter entry, so the
        // product editor always has a category, brand and supplier to offer.
        set({
          categories: categories.length ? categories : DEFAULTS.categories,
          brands: brands.length ? brands : DEFAULTS.brands,
          suppliers: suppliers.length ? suppliers : DEFAULTS.suppliers,
        });
      },

      addEntity: (kind, name, description, details, parentId) => {
        const entity: MetaEntity = {
          id: uid(),
          name,
          description,
          ...(details ? { details } : {}),
          ...(parentId ? { parentId } : {}),
        };
        // The first real entry of a kind also writes the starter entry (e.g.
        // "General") to the cloud, so products that reference it keep working
        // once the kind is no longer empty.
        for (const d of DEFAULTS[kind]) {
          if (get()[kind].some((e) => e.id === d.id)) dbCatalogMeta.upsert(toRow(kind, d));
        }
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
        // Deleting a category takes the levels nested under it with it.
        const ids = kind === 'categories' ? categoryDescendantIds(get().categories, id) : new Set([id]);
        set((s) => ({ [kind]: s[kind].filter((e) => !ids.has(e.id)) }) as Partial<CatalogMetaState>);
        ids.forEach((x) => dbCatalogMeta.del(x));
      },
    }),
    { name: 'nova-catalog-meta-v1' },
  ),
);
