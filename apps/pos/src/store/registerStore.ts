import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbRegisterConfig } from '../lib/db';

// Per-register settings (training mode, quick keys and their layouts).
// Drives the Sell register screen and the register Settings page.

/** A product placed on a layout grid, with its per-key display overrides. */
export interface QuickKey {
  id: string;
  productId: string;
  label: string;
  /** '' = the default (uncoloured) key. */
  color: string;
  showImage: boolean;
  /** Grid position, 0-based. */
  slot: number;
}

export interface QuickKeyLayout {
  id: string;
  name: string;
  keys: QuickKey[];
  /** "Leave selected folder open until end of the sale" */
  keepFolderOpen: boolean;
}

/** Size of the layout grid: 5 columns wide. */
export const QK_COLS = 5;
export const QK_SLOTS = 40;

/** Key colours offered in the Edit quick key modal. '' is the default grey. */
export const QK_COLORS = ['#e13ec9', '#ef6f3c', '#f0c53c', '#c25fd0', '#7b8cf0', '#8c4ae2', ''];

interface RegisterState {
  trainingMode: boolean;
  quickKeysEnabled: boolean;
  layouts: QuickKeyLayout[];
  currentLayoutId: string;

  /** Sync trainingMode from Supabase. */
  syncFromDb: () => Promise<void>;
  toggleTraining: () => void;
  toggleQuickKeys: () => void;
  addLayout: () => void;
  renameLayout: (id: string, name: string) => void;
  duplicateLayout: (id: string) => void;
  deleteLayout: (id: string) => void;
  setCurrentLayout: (id: string) => void;

  updateLayout: (id: string, patch: Partial<Pick<QuickKeyLayout, 'name' | 'keepFolderOpen'>>) => void;
  /** Place a product on the first free slot of a layout. */
  addKey: (layoutId: string, product: { id: string; name: string }) => void;
  updateKey: (layoutId: string, keyId: string, patch: Partial<Omit<QuickKey, 'id'>>) => void;
  deleteKey: (layoutId: string, keyId: string) => void;
  /** Drag a key to a slot; swaps with whatever is already there. */
  moveKey: (layoutId: string, keyId: string, slot: number) => void;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

export const useRegister = create<RegisterState>()(
  persist(
    (set, get) => ({
      trainingMode: false,
      quickKeysEnabled: true,
      layouts: [{ id: 'default', name: 'Default layout', keys: [], keepFolderOpen: false }],
      currentLayoutId: 'default',

      syncFromDb: async () => {
        const row = await dbRegisterConfig.get();
        if (!row) return;
        set({ trainingMode: row.training_mode ?? false });
      },

      toggleTraining: () => {
        const trainingMode = !get().trainingMode;
        set({ trainingMode });
        dbRegisterConfig.save({ training_mode: trainingMode });
      },

      toggleQuickKeys: () => set((s) => ({ quickKeysEnabled: !s.quickKeysEnabled })),

      addLayout: () =>
        set((s) => ({
          layouts: [...s.layouts, { id: uid(), name: 'New Layout', keys: [], keepFolderOpen: false }],
        })),

      renameLayout: (id, name) =>
        set((s) => {
          const trimmed = name.trim();
          if (!trimmed) return s;
          return { layouts: s.layouts.map((l) => (l.id === id ? { ...l, name: trimmed } : l)) };
        }),

      duplicateLayout: (id) =>
        set((s) => {
          const src = s.layouts.find((l) => l.id === id);
          if (!src) return s;
          return {
            layouts: [
              ...s.layouts,
              {
                ...src,
                id: uid(),
                name: `${src.name} copy`,
                keys: src.keys.map((k) => ({ ...k, id: uid() })),
              },
            ],
          };
        }),

      deleteLayout: (id) =>
        set((s) => {
          if (s.layouts.length <= 1) return s;
          const layouts = s.layouts.filter((l) => l.id !== id);
          const first = layouts[0];
          if (!first) return s;
          return {
            layouts,
            currentLayoutId: s.currentLayoutId === id ? first.id : s.currentLayoutId,
          };
        }),

      setCurrentLayout: (id) => set({ currentLayoutId: id }),

      updateLayout: (id, patch) =>
        set((s) => ({ layouts: s.layouts.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),

      addKey: (layoutId, product) =>
        set((s) => ({
          layouts: s.layouts.map((l) => {
            if (l.id !== layoutId) return l;
            const taken = new Set(l.keys.map((k) => k.slot));
            let slot = 0;
            while (taken.has(slot) && slot < QK_SLOTS) slot += 1;
            if (slot >= QK_SLOTS) return l;
            return {
              ...l,
              keys: [
                ...l.keys,
                { id: uid(), productId: product.id, label: product.name, color: '', showImage: false, slot },
              ],
            };
          }),
        })),

      updateKey: (layoutId, keyId, patch) =>
        set((s) => ({
          layouts: s.layouts.map((l) =>
            l.id === layoutId
              ? { ...l, keys: l.keys.map((k) => (k.id === keyId ? { ...k, ...patch } : k)) }
              : l,
          ),
        })),

      deleteKey: (layoutId, keyId) =>
        set((s) => ({
          layouts: s.layouts.map((l) =>
            l.id === layoutId ? { ...l, keys: l.keys.filter((k) => k.id !== keyId) } : l,
          ),
        })),

      moveKey: (layoutId, keyId, slot) =>
        set((s) => ({
          layouts: s.layouts.map((l) => {
            if (l.id !== layoutId) return l;
            const moving = l.keys.find((k) => k.id === keyId);
            if (!moving || moving.slot === slot) return l;
            const occupant = l.keys.find((k) => k.slot === slot);
            return {
              ...l,
              keys: l.keys.map((k) => {
                if (k.id === keyId) return { ...k, slot };
                // Swap the displaced key back into the vacated slot.
                if (occupant && k.id === occupant.id) return { ...k, slot: moving.slot };
                return k;
              }),
            };
          }),
        })),
    }),
    {
      name: 'nova-register-v1',
      version: 2,
      // v1 layouts were { id, name } only — give them an empty grid.
      migrate: (persisted, version) => {
        type OldLayout = Partial<QuickKeyLayout> & { id: string; name: string };
        const s = persisted as { layouts?: OldLayout[] } | undefined;
        if (s && version < 2) {
          s.layouts = (s.layouts ?? []).map((l) => ({
            ...l,
            keys: l.keys ?? [],
            keepFolderOpen: l.keepFolderOpen ?? false,
          }));
        }
        return s as RegisterState;
      },
    },
  ),
);
