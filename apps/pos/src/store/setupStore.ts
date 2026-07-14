import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbSetup } from '../lib/db';

// Persisted back-office configuration: general setup, contact info, apps,
// on-account, loyalty, store credit / saved payments, billing, sales target,
// payment types, and outlets & registers.
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
  // Payment types
  paymentTypes: PaymentType[];
  // Outlets & registers
  outlets: Outlet[];
  receiptTemplates: ReceiptTemplate[];

  /** Pull setup config from Supabase. */
  syncFromDb: () => Promise<void>;
  set: (patch: Partial<SetupState>) => void;
  toggleApp: (name: string) => void;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

export const newId = uid;

// Map SetupState → DB snake_case row.
const toRow = (s: SetupState): Record<string, unknown> => ({
  currency: s.currency,
  time_zone: s.timeZone,
  sequence_number: s.sequenceNumber,
  embedded_barcodes: s.embeddedBarcodes,
  gen_sku: s.genSku,
  auto_cust: s.autoCust,
  combine_sku: s.combineSku,
  diff_postal: s.diffPostal,
  hide_on_order: s.hideOnOrder,
  contact_first_name: s.contactFirstName,
  contact_last_name: s.contactLastName,
  contact_email: s.contactEmail,
  contact_phone: s.contactPhone,
  contact_website: s.contactWebsite,
  contact_twitter: s.contactTwitter,
  contact_street1: s.contactStreet1,
  contact_street2: s.contactStreet2,
  contact_suburb: s.contactSuburb,
  contact_city: s.contactCity,
  contact_zip: s.contactZip,
  contact_state: s.contactState,
  contact_country: s.contactCountry,
  connected_apps: s.connectedApps,
  on_account_enabled: s.onAccountEnabled,
  on_account_limit: s.onAccountLimit,
  loyalty_enabled: s.loyaltyEnabled,
  loyalty_pct: s.loyaltyPct,
  loyalty_redemption_min: s.loyaltyRedemptionMin,
  loyalty_signup_bonus: s.loyaltySignupBonus,
  loyalty_welcome_email: s.loyaltyWelcomeEmail,
  loyalty_expiry: s.loyaltyExpiry,
  store_credit_enabled: s.storeCreditEnabled,
  saved_payment_enabled: s.savedPaymentEnabled,
  billing_plan_id: s.billingPlanId,
  billing_frequency: s.billingFrequency,
  sales_target_minor: s.salesTargetMinor,
  payment_types: s.paymentTypes,
  outlets: s.outlets,
  receipt_templates: s.receiptTemplates,
});

// Map DB row → Partial<SetupState>.
const fromRow = (r: Record<string, unknown>): Partial<SetupState> => ({
  currency: r.currency as string,
  timeZone: r.time_zone as string,
  sequenceNumber: r.sequence_number as string,
  embeddedBarcodes: r.embedded_barcodes as string,
  genSku: r.gen_sku as boolean,
  autoCust: r.auto_cust as boolean,
  combineSku: r.combine_sku as boolean,
  diffPostal: r.diff_postal as boolean,
  hideOnOrder: r.hide_on_order as boolean,
  contactFirstName: r.contact_first_name as string,
  contactLastName: r.contact_last_name as string,
  contactEmail: r.contact_email as string,
  contactPhone: r.contact_phone as string,
  contactWebsite: r.contact_website as string,
  contactTwitter: r.contact_twitter as string,
  contactStreet1: r.contact_street1 as string,
  contactStreet2: r.contact_street2 as string,
  contactSuburb: r.contact_suburb as string,
  contactCity: r.contact_city as string,
  contactZip: r.contact_zip as string,
  contactState: r.contact_state as string,
  contactCountry: r.contact_country as string,
  connectedApps: (r.connected_apps as string[]) ?? [],
  onAccountEnabled: r.on_account_enabled as boolean,
  onAccountLimit: r.on_account_limit as string,
  loyaltyEnabled: r.loyalty_enabled as boolean,
  loyaltyPct: r.loyalty_pct as number,
  loyaltyRedemptionMin: r.loyalty_redemption_min as boolean,
  loyaltySignupBonus: r.loyalty_signup_bonus as boolean,
  loyaltyWelcomeEmail: r.loyalty_welcome_email as boolean,
  loyaltyExpiry: r.loyalty_expiry as string,
  storeCreditEnabled: r.store_credit_enabled as boolean,
  savedPaymentEnabled: r.saved_payment_enabled as boolean,
  billingPlanId: r.billing_plan_id as string,
  billingFrequency: r.billing_frequency as 'monthly' | 'annual',
  salesTargetMinor: r.sales_target_minor as number,
  paymentTypes: (r.payment_types as PaymentType[]) ?? [],
  outlets: (r.outlets as Outlet[]) ?? [],
  receiptTemplates: (r.receipt_templates as ReceiptTemplate[]) ?? [],
});

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

      syncFromDb: async () => {
        const row = await dbSetup.get();
        if (!row) return;
        set(fromRow(row));
      },

      set: (patch) => {
        set(patch);
        // After applying the patch, save the full merged state to Supabase.
        dbSetup.save(toRow({ ...get(), ...patch }));
      },

      toggleApp: (name) => {
        const cur = get().connectedApps;
        const connectedApps = cur.includes(name)
          ? cur.filter((a) => a !== name)
          : [...cur, name];
        set({ connectedApps });
        dbSetup.save({ connected_apps: connectedApps });
      },
    }),
    { name: 'nova-setup-v1' },
  ),
);
