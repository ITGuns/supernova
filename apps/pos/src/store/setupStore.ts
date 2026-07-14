import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Persisted back-office configuration: general setup, contact info, apps,
// on-account, loyalty, store credit / saved payments, billing, sales target,
// payment types, and outlets & registers. One flat store keeps the many small
// settings pages simple — each page reads its slice and calls set(patch).
export interface PaymentType {
  id: string;
  name: string;
  sub: string;
  icon: string;
}

export interface Outlet {
  id: string;
  name: string;
  registers: string[];
}

export interface ReceiptTemplate {
  id: string;
  name: string;
}

export interface SetupState {
  // General
  currency: string;
  timeZone: string;
  sequenceNumber: string;
  embeddedBarcodes: string;
  genSku: boolean;
  autoCust: boolean;
  combineSku: boolean;
  diffPostal: boolean;
  hideOnOrder: boolean;
  // Contact information
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  contactPhone: string;
  contactWebsite: string;
  contactTwitter: string;
  contactStreet1: string;
  contactStreet2: string;
  contactSuburb: string;
  contactCity: string;
  contactZip: string;
  contactState: string;
  contactCountry: string;
  // Apps + on account
  connectedApps: string[];
  onAccountEnabled: boolean;
  onAccountLimit: string;
  // Loyalty
  loyaltyEnabled: boolean;
  loyaltyPct: number;
  loyaltyRedemptionMin: boolean;
  loyaltySignupBonus: boolean;
  loyaltyWelcomeEmail: boolean;
  loyaltyExpiry: string;
  // Store credit / saved payments
  storeCreditEnabled: boolean;
  savedPaymentEnabled: boolean;
  // Billing
  billingPlanId: string;
  billingFrequency: 'monthly' | 'annual';
  // Home page
  salesTargetMinor: number;
  // Payment types (register tender options are CASH/CARD; this list is the
  // configured display types)
  paymentTypes: PaymentType[];
  // Outlets & registers
  outlets: Outlet[];
  receiptTemplates: ReceiptTemplate[];

  set: (patch: Partial<SetupState>) => void;
  toggleApp: (name: string) => void;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

export const newId = uid;

export const useSetup = create<SetupState>()(
  persist(
    (set, get) => ({
      currency: 'USD — United States Dollar',
      timeZone: '(UTC-05:00) Eastern Time (US & Canada)',
      sequenceNumber: '10207',
      embeddedBarcodes: 'Disabled',
      genSku: true,
      autoCust: false,
      combineSku: true,
      diffPostal: false,
      hideOnOrder: false,
      contactFirstName: '',
      contactLastName: '',
      contactEmail: '',
      contactPhone: '',
      contactWebsite: '',
      contactTwitter: '',
      contactStreet1: '',
      contactStreet2: '',
      contactSuburb: '',
      contactCity: '',
      contactZip: '',
      contactState: '',
      contactCountry: 'United States',
      connectedApps: [],
      onAccountEnabled: true,
      onAccountLimit: '',
      loyaltyEnabled: false,
      loyaltyPct: 10,
      loyaltyRedemptionMin: false,
      loyaltySignupBonus: false,
      loyaltyWelcomeEmail: true,
      loyaltyExpiry: 'Never',
      storeCreditEnabled: true,
      savedPaymentEnabled: false,
      billingPlanId: 'core',
      billingFrequency: 'monthly',
      salesTargetMinor: 0,
      paymentTypes: [
        { id: 'pt-cash', name: 'Cash', sub: 'Built-in', icon: '💵' },
        { id: 'pt-card', name: 'Credit / Debit card', sub: 'Built-in', icon: '💳' },
      ],
      outlets: [{ id: 'o-main', name: 'Main Outlet', registers: ['Main Register'] }],
      receiptTemplates: [{ id: 'r-default', name: 'Standard receipt' }],

      set: (patch) => set(patch),
      toggleApp: (name) => {
        const cur = get().connectedApps;
        set({
          connectedApps: cur.includes(name) ? cur.filter((a) => a !== name) : [...cur, name],
        });
      },
    }),
    { name: 'nova-setup-v1' },
  ),
);
