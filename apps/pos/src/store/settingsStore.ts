import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbSettings } from '../lib/db';

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
  /** Pull latest values from Supabase and merge into local state. */
  syncFromDb: () => Promise<void>;
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

      syncFromDb: async () => {
        const row = await dbSettings.get();
        if (!row) return;
        set({
          storeName: row.store_name ?? get().storeName,
          defaultTaxLabel: row.default_tax_label ?? get().defaultTaxLabel,
          defaultTaxRateBps: row.default_tax_rate_bps ?? get().defaultTaxRateBps,
          taxes: Array.isArray(row.taxes) && row.taxes.length ? row.taxes : get().taxes,
        });
      },

      setStoreName: (storeName) => {
        set({ storeName });
        dbSettings.save({ store_name: storeName });
      },

      setDefaultTax: (label) => {
        const opt = get().taxes.find((o) => o.label === label);
        const defaultTaxRateBps = opt ? opt.rateBps : 0;
        set({ defaultTaxLabel: label, defaultTaxRateBps });
        dbSettings.save({ default_tax_label: label, default_tax_rate_bps: defaultTaxRateBps });
      },

      addTax: (label, rateBps) => {
        const taxes = [...get().taxes, { id: uid(), label, rateBps }];
        set({ taxes });
        dbSettings.save({ taxes });
      },

      updateTax: (id, patch) => {
        const taxes = get().taxes.map((t) => (t.id === id ? { ...t, ...patch } : t));
        const edited = taxes.find((t) => t.id === id);
        const wasDefault = get().taxes.find((t) => t.id === id)?.label === get().defaultTaxLabel;
        const extra =
          wasDefault && edited
            ? { defaultTaxLabel: edited.label, defaultTaxRateBps: edited.rateBps }
            : {};
        set({ taxes, ...extra });
        dbSettings.save({
          taxes,
          ...(extra.defaultTaxLabel
            ? {
                default_tax_label: extra.defaultTaxLabel,
                default_tax_rate_bps: extra.defaultTaxRateBps,
              }
            : {}),
        });
      },

      deleteTax: (id) => {
        const removed = get().taxes.find((t) => t.id === id);
        const taxes = get().taxes.filter((t) => t.id !== id);
        const patch: Partial<SettingsState> = { taxes };
        if (removed && removed.label === get().defaultTaxLabel) {
          patch.defaultTaxLabel = 'No Tax (0%)';
          patch.defaultTaxRateBps = 0;
        }
        set(patch);
        dbSettings.save({
          taxes,
          default_tax_label: patch.defaultTaxLabel ?? get().defaultTaxLabel,
          default_tax_rate_bps: patch.defaultTaxRateBps ?? get().defaultTaxRateBps,
        });
      },
    }),
    { name: 'nova-settings-v2', version: 1, migrate: (persisted: unknown) => persisted as SettingsState },
  ),
);
