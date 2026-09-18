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
// A new store starts with no tax applied; real rates are added in Setup.
export const TAX_OPTIONS: TaxOption[] = [
  { id: 'tax-none', label: 'No Tax (0%)', rateBps: 0 },
];

/** Several taxes charged together (Setup → Sales taxes → Combine Taxes into a Group). */
export interface TaxGroup {
  id: string;
  name: string;
  taxIds: string[];
}

interface SettingsState {
  storeName: string;
  defaultTaxLabel: string;
  defaultTaxRateBps: number;
  taxes: TaxOption[];
  taxGroups: TaxGroup[];
  /** Show prices excluding tax (tax added at the register) instead of tax-inclusive. */
  taxExclusive: boolean;
  /** Pull latest values from Supabase and merge into local state. */
  syncFromDb: () => Promise<void>;
  setStoreName: (n: string) => void;
  setDefaultTax: (label: string) => void;
  addTax: (label: string, rateBps: number) => void;
  updateTax: (id: string, patch: Partial<Omit<TaxOption, 'id'>>) => void;
  deleteTax: (id: string) => void;
  addTaxGroup: (name: string, taxIds: string[]) => void;
  updateTaxGroup: (id: string, patch: Partial<Omit<TaxGroup, 'id'>>) => void;
  deleteTaxGroup: (id: string) => void;
  setTaxExclusive: (on: boolean) => void;
}

// Whether the settings row has the newer columns (migrations 0009 / 0010).
let hasTaxGroups = true;
let hasTaxExclusive = true;

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      storeName: 'Nova Retail',
      defaultTaxLabel: 'No Tax (0%)',
      defaultTaxRateBps: 0,
      taxes: TAX_OPTIONS,
      taxGroups: [],
      taxExclusive: false,

      syncFromDb: async () => {
        const [row, groupsProbe, exclProbe] = await Promise.all([dbSettings.get(), dbSettings.hasTaxGroups(), dbSettings.hasTaxExclusive()]);
        if (groupsProbe !== null) hasTaxGroups = groupsProbe;
        if (exclProbe !== null) hasTaxExclusive = exclProbe;
        if (!row) return;
        set({
          storeName: row.store_name ?? get().storeName,
          defaultTaxLabel: row.default_tax_label ?? get().defaultTaxLabel,
          defaultTaxRateBps: row.default_tax_rate_bps ?? get().defaultTaxRateBps,
          taxes: Array.isArray(row.taxes) && row.taxes.length ? row.taxes : get().taxes,
          taxGroups: Array.isArray(row.tax_groups) ? (row.tax_groups as TaxGroup[]) : get().taxGroups,
          taxExclusive: typeof row.tax_exclusive === 'boolean' ? row.tax_exclusive : get().taxExclusive,
        });
      },

      addTaxGroup: (name, taxIds) => {
        const taxGroups = [...get().taxGroups, { id: uid(), name, taxIds }];
        set({ taxGroups });
        if (hasTaxGroups) dbSettings.save({ tax_groups: taxGroups });
      },

      updateTaxGroup: (id, patch) => {
        const taxGroups = get().taxGroups.map((g) => (g.id === id ? { ...g, ...patch } : g));
        set({ taxGroups });
        if (hasTaxGroups) dbSettings.save({ tax_groups: taxGroups });
      },

      deleteTaxGroup: (id) => {
        const taxGroups = get().taxGroups.filter((g) => g.id !== id);
        set({ taxGroups });
        if (hasTaxGroups) dbSettings.save({ tax_groups: taxGroups });
      },

      setTaxExclusive: (taxExclusive) => {
        set({ taxExclusive });
        if (hasTaxExclusive) dbSettings.save({ tax_exclusive: taxExclusive });
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
