import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbCustomers } from '../lib/db';
import { EMPTY_CUSTOMER_ADDRESS, EMPTY_CUSTOMER_DETAILS, type CustomerDetails, type CustomerRow } from '../data/customers';

// Persisted customers, shared across the Customers page, the register
// (attach a customer to a sale) and reporting (store credit / loyalty).
interface CustomerState {
  customers: CustomerRow[];
  groups: string[];
  /** When each group was created (epoch ms), where known. */
  groupCreated: Record<string, number>;
  /** Pull customers + groups from Supabase. */
  syncFromDb: () => Promise<void>;
  addCustomer: (c: Omit<CustomerRow, 'id'>) => CustomerRow;
  updateCustomer: (id: string, patch: Partial<CustomerRow>) => void;
  deleteCustomer: (id: string) => void;
  addGroup: (name: string) => void;
  deleteGroup: (name: string) => void;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

// Whether the cloud table has the on-account limit / loyalty columns (migration 0009)
// and the details column (0010).
let hasLimitColumns = true;
let hasDetails = true;

/** Fill in any missing parts of a stored details object. */
export const normaliseDetails = (d: Partial<CustomerDetails> | null | undefined): CustomerDetails => ({
  ...EMPTY_CUSTOMER_DETAILS,
  ...(d ?? {}),
  physical: { ...EMPTY_CUSTOMER_ADDRESS, ...(d?.physical ?? {}) },
  postal: { ...EMPTY_CUSTOMER_ADDRESS, ...(d?.postal ?? {}) },
  customFields: { ...(d?.customFields ?? {}) },
});

// Map between the app's camelCase CustomerRow and the snake_case DB columns.
// The previous spread-through wrote camelCase keys the table rejected, so
// every customer write 409'd and nothing ever reached Supabase.
const toRow = (c: CustomerRow): Record<string, unknown> => ({
  id: c.id,
  first_name: c.firstName,
  last_name: c.lastName,
  code: c.code,
  email: c.email || null,
  phone: c.phone || null,
  group: c.group,
  store_credit_minor: c.storeCreditMinor,
  loyalty_points: c.loyaltyMinor,
  account_minor: c.accountMinor,
  ...(hasLimitColumns ? { on_account_limit_minor: c.onAccountLimitMinor ?? null, loyalty_enabled: c.loyaltyEnabled ?? true } : {}),
  ...(hasDetails ? { details: c.details ?? {} } : {}),
  // The legacy address columns mirror the physical address so older reports keep working.
  address: c.details?.physical.street1 || null,
  city: c.details?.physical.city || null,
  state: c.details?.physical.state || null,
  zip: c.details?.physical.zip || null,
  country: c.details?.physical.country || null,
  notes: c.details?.notes || null,
});

const fromRow = (r: Record<string, unknown>): CustomerRow => ({
  id: r.id as string,
  firstName: (r.first_name as string | null) ?? '',
  lastName: (r.last_name as string | null) ?? '',
  code: (r.code as string | null) ?? '',
  group: (r.group as string | null) ?? 'All Customers',
  email: (r.email as string | null) ?? '',
  phone: (r.phone as string | null) ?? '',
  storeCreditMinor: (r.store_credit_minor as number | null) ?? 0,
  loyaltyMinor: (r.loyalty_points as number | null) ?? 0,
  accountMinor: (r.account_minor as number | null) ?? 0,
  onAccountLimitMinor: (r.on_account_limit_minor as number | null) ?? null,
  loyaltyEnabled: r.loyalty_enabled !== false,
  details: normaliseDetails(r.details as Partial<CustomerDetails> | null),
  createdAt: r.created_at ? new Date(r.created_at as string).getTime() : undefined,
});

export const useCustomers = create<CustomerState>()(
  persist(
    (set, get) => ({
      customers: [],
      groups: ['All Customers'],
      groupCreated: {},

      syncFromDb: async () => {
        const [rows, groups, probe, detailsProbe] = await Promise.all([
          dbCustomers.list(),
          dbCustomers.listGroups(),
          dbCustomers.hasLimitColumns(),
          dbCustomers.hasDetails(),
        ]);
        if (probe !== null) hasLimitColumns = probe;
        if (detailsProbe !== null) hasDetails = detailsProbe;
        if (rows) set({ customers: rows.map(fromRow) });
        // "All Customers" must always exist, so an empty cloud keeps the defaults.
        if (groups && groups.length) {
          const groupCreated: Record<string, number> = { ...get().groupCreated };
          groups.forEach((g) => {
            if (g.createdAt) groupCreated[g.name] = g.createdAt;
          });
          set({ groups: groups.map((g) => g.name), groupCreated });
        }
      },

      addCustomer: (c) => {
        const created: CustomerRow = { ...c, id: uid(), createdAt: Date.now() };
        set((s) => ({ customers: [created, ...s.customers] }));
        dbCustomers.upsert(toRow(created));
        return created;
      },

      updateCustomer: (id, patch) => {
        let updated: CustomerRow | undefined;
        set((s) => {
          const customers = s.customers.map((x) => {
            if (x.id === id) { updated = { ...x, ...patch }; return updated; }
            return x;
          });
          return { customers };
        });
        if (updated) dbCustomers.upsert(toRow(updated));
      },

      deleteCustomer: (id) => {
        set((s) => ({ customers: s.customers.filter((x) => x.id !== id) }));
        dbCustomers.del(id);
      },

      addGroup: (name) => {
        // Group names are unique in the cloud too: adding one that already
        // exists is a no-op rather than a duplicate-key error.
        if (get().groups.includes(name)) return;
        set((s) => ({ groups: [...s.groups, name], groupCreated: { ...s.groupCreated, [name]: Date.now() } }));
        dbCustomers.addGroup(name);
      },

      deleteGroup: (name) => {
        set((s) =>
          name === 'All Customers' ? s : { groups: s.groups.filter((g) => g !== name) },
        );
        if (name !== 'All Customers') dbCustomers.delGroup(name);
      },
    }),
    { name: 'nova-customers-v1' },
  ),
);
