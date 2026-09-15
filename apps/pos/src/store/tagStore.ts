import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbProductTags } from '../lib/db';
import { useProducts } from './productStore';

// Product tags, managed on Catalog → Product tags. A tag is a row of its own
// (so it can exist before any product uses it) and products carry the tag
// names in `products.tags`; renaming or deleting a tag follows through to
// every product that uses it.

export interface ProductTag {
  id: string;
  name: string;
  createdAt: number;
}

interface TagState {
  tags: ProductTag[];
  /** Pull tags from Supabase. */
  syncFromDb: () => Promise<void>;
  /** Create a tag; returns null when the name is blank or already taken. */
  addTag: (name: string) => ProductTag | null;
  /** Rename a tag everywhere; false when the new name is blank or taken. */
  renameTag: (id: string, name: string) => boolean;
  /** Delete a tag and strip it from every product. */
  deleteTag: (id: string) => void;
  /** Make sure a tag row exists for each name (used when a product is saved). */
  ensureTags: (names: string[]) => void;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

/** Tags compare case-insensitively: "Sale" and "sale" are the same tag. */
export const tagKey = (name: string): string => name.trim().toLowerCase();

// Whether the cloud has the product_tags table (migration 0007). Until it
// does, tags live in this device's cache only.
let hasTable = true;

const toRow = (t: ProductTag): Record<string, unknown> => ({
  id: t.id,
  name: t.name,
  created_at: new Date(t.createdAt).toISOString(),
});

export const useProductTags = create<TagState>()(
  persist(
    (set, get) => ({
      tags: [],

      syncFromDb: async () => {
        const rows = await dbProductTags.list();
        if (rows === null) return; // request failed — keep cached tags
        if (rows === 'missing') {
          hasTable = false;
          return;
        }
        hasTable = true;
        const seen = new Set<string>();
        const tags: ProductTag[] = [];
        for (const r of rows) {
          const name = String(r.name ?? '').trim();
          if (!name || seen.has(tagKey(name))) continue;
          seen.add(tagKey(name));
          tags.push({ id: r.id as string, name, createdAt: new Date(r.created_at as string).getTime() });
        }
        set({ tags }); // [] is a real answer: no tags
      },

      addTag: (rawName) => {
        const name = rawName.trim();
        if (!name || get().tags.some((t) => tagKey(t.name) === tagKey(name))) return null;
        const tag: ProductTag = { id: uid(), name, createdAt: Date.now() };
        set((s) => ({ tags: [...s.tags, tag] }));
        if (hasTable) dbProductTags.upsert(toRow(tag));
        return tag;
      },

      renameTag: (id, rawName) => {
        const name = rawName.trim();
        const current = get().tags.find((t) => t.id === id);
        if (!current || !name) return false;
        if (get().tags.some((t) => t.id !== id && tagKey(t.name) === tagKey(name))) return false;
        const tags = get().tags.map((t) => (t.id === id ? { ...t, name } : t));
        set({ tags });
        if (hasTable) dbProductTags.upsert(toRow({ ...current, name }));
        // Follow the rename through every product that carries the old name.
        const prodStore = useProducts.getState();
        for (const p of prodStore.products) {
          if ((p.tags ?? []).some((t) => tagKey(t) === tagKey(current.name))) {
            prodStore.updateProduct(p.id, {
              tags: (p.tags ?? []).map((t) => (tagKey(t) === tagKey(current.name) ? name : t)),
            });
          }
        }
        return true;
      },

      deleteTag: (id) => {
        const current = get().tags.find((t) => t.id === id);
        if (!current) return;
        set((s) => ({ tags: s.tags.filter((t) => t.id !== id) }));
        if (hasTable) dbProductTags.del(id);
        const prodStore = useProducts.getState();
        for (const p of prodStore.products) {
          if ((p.tags ?? []).some((t) => tagKey(t) === tagKey(current.name))) {
            prodStore.updateProduct(p.id, { tags: (p.tags ?? []).filter((t) => tagKey(t) !== tagKey(current.name)) });
          }
        }
      },

      ensureTags: (names) => {
        const known = new Set(get().tags.map((t) => tagKey(t.name)));
        const fresh: ProductTag[] = [];
        for (const raw of names) {
          const name = raw.trim();
          if (!name || known.has(tagKey(name))) continue;
          known.add(tagKey(name));
          fresh.push({ id: uid(), name, createdAt: Date.now() });
        }
        if (!fresh.length) return;
        set((s) => ({ tags: [...s.tags, ...fresh] }));
        if (hasTable) fresh.forEach((t) => dbProductTags.upsert(toRow(t)));
      },
    }),
    { name: 'nova-product-tags-v1' },
  ),
);
