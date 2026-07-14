import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Store-wide settings that actually drive the app (checkout tax, store name, etc.).
export interface TaxOption {
  id: string;
  label: string;
  rateBps: number;
}

// Initial seed — the live, editable list lives in the store (Setup → Sales taxes).
export const TAX_OPTIONS: TaxOption[] = [
  { id: 'tax-none', label: 'No Tax (0%)', rateBps: 0 },
  { id: 'tax-sales', label: 'Sales Tax (8.25%)', rateBps: 825 },
  { id: 'tax-food', label: 'Food (0%)', rateBps: 0 },
];

interface SettingsState {
  storeName: string;
  defaultTaxLabel: string;
  defaultTaxRateBps: number;
  taxes: TaxOption[];
  setStoreName: (n: string) => void;
  setDefaultTax: (label: string) => void;
  addTax: (label: string, rateBps: number) => void;
  updateTax: (id: string, patch: Partial<Omit<TaxOption, 'id'>>) => void;
  deleteTax: (id: string) => void;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      storeName: 'Nova — Downtown',
      defaultTaxLabel: 'No Tax (0%)',
      defaultTaxRateBps: 0,
      taxes: TAX_OPTIONS,
      setStoreName: (storeName) => set({ storeName }),
      setDefaultTax: (label) => {
        const opt = get().taxes.find((o) => o.label === label);
        set({ defaultTaxLabel: label, defaultTaxRateBps: opt ? opt.rateBps : 0 });
      },
      addTax: (label, rateBps) =>
        set((s) => ({ taxes: [...s.taxes, { id: uid(), label, rateBps }] })),
      updateTax: (id, patch) =>
        set((s) => {
          const taxes = s.taxes.map((t) => (t.id === id ? { ...t, ...patch } : t));
          // Keep the checkout default in sync if the edited tax is the default.
          const edited = taxes.find((t) => t.id === id);
          const wasDefault = s.taxes.find((t) => t.id === id)?.label === s.defaultTaxLabel;
          return wasDefault && edited
            ? { taxes, defaultTaxLabel: edited.label, defaultTaxRateBps: edited.rateBps }
            : { taxes };
        }),
      deleteTax: (id) =>
        set((s) => {
          const removed = s.taxes.find((t) => t.id === id);
          const taxes = s.taxes.filter((t) => t.id !== id);
          const patch: Partial<SettingsState> = { taxes };
          if (removed && removed.label === s.defaultTaxLabel) {
            patch.defaultTaxLabel = 'No Tax (0%)';
            patch.defaultTaxRateBps = 0;
          }
          return patch;
        }),
    }),
    { name: 'nova-settings-v2', version: 1, migrate: (persisted: unknown) => persisted as SettingsState },
  ),
);
