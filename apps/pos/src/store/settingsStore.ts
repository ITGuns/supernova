import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Store-wide settings that actually drive the app (checkout tax, store name, etc.).
export interface TaxOption {
  label: string;
  rateBps: number;
}

export const TAX_OPTIONS: TaxOption[] = [
  { label: 'No Tax (0%)', rateBps: 0 },
  { label: 'Sales Tax (8.25%)', rateBps: 825 },
  { label: 'Food (0%)', rateBps: 0 },
];

interface SettingsState {
  storeName: string;
  defaultTaxLabel: string;
  defaultTaxRateBps: number;
  setStoreName: (n: string) => void;
  setDefaultTax: (label: string) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      storeName: 'Nova — Downtown',
      defaultTaxLabel: 'No Tax (0%)',
      defaultTaxRateBps: 0,
      setStoreName: (storeName) => set({ storeName }),
      setDefaultTax: (label) => {
        const opt = TAX_OPTIONS.find((o) => o.label === label);
        set({ defaultTaxLabel: label, defaultTaxRateBps: opt ? opt.rateBps : 0 });
      },
    }),
    { name: 'nova-settings-v2' },
  ),
);
