import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Per-register settings (training mode, quick keys and their layouts).
// Drives the Sell register screen and the register Settings page.
export interface QuickKeyLayout {
  id: string;
  name: string;
}

interface RegisterState {
  trainingMode: boolean;
  quickKeysEnabled: boolean;
  layouts: QuickKeyLayout[];
  currentLayoutId: string;

  toggleTraining: () => void;
  toggleQuickKeys: () => void;
  addLayout: () => void;
  renameLayout: (id: string, name: string) => void;
  duplicateLayout: (id: string) => void;
  deleteLayout: (id: string) => void;
  setCurrentLayout: (id: string) => void;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

export const useRegister = create<RegisterState>()(
  persist(
    (set) => ({
      trainingMode: false,
      quickKeysEnabled: true,
      layouts: [{ id: 'default', name: 'Default layout' }],
      currentLayoutId: 'default',

      toggleTraining: () => set((s) => ({ trainingMode: !s.trainingMode })),
      toggleQuickKeys: () => set((s) => ({ quickKeysEnabled: !s.quickKeysEnabled })),

      addLayout: () =>
        set((s) => ({ layouts: [...s.layouts, { id: uid(), name: 'New Layout' }] })),

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
          return { layouts: [...s.layouts, { id: uid(), name: `${src.name} copy` }] };
        }),

      deleteLayout: (id) =>
        set((s) => {
          if (s.layouts.length <= 1) return s;
          const layouts = s.layouts.filter((l) => l.id !== id);
          const first = layouts[0];
          if (!first) return s;
          return {
            layouts,
            // If the current layout was deleted, fall back to the first remaining one.
            currentLayoutId: s.currentLayoutId === id ? first.id : s.currentLayoutId,
          };
        }),

      setCurrentLayout: (id) => set({ currentLayoutId: id }),
    }),
    { name: 'nova-register-v1' },
  ),
);
