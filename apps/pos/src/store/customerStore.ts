import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbCustomers } from '../lib/db';
import type { CustomerRow } from '../data/customers';

// Persisted customers, shared across the Customers page, the register
// (attach a customer to a sale) and reporting (store credit / loyalty).
interface CustomerState {
  customers: CustomerRow[];
  groups: string[];
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

// CustomerRow is already flat — the column names match closely enough
// that we only need to snake_case the keys that differ.
const toRow = (c: CustomerRow): Record<string, unknown> => ({ ...c });
const fromRow = (r: Record<string, unknown>): CustomerRow => r as unknown as CustomerRow;

export const useCustomers = create<CustomerState>()(
  persist(
    (set) => ({
      customers: [],
      groups: ['All Customers', 'VIP', 'Wholesale'],

      syncFromDb: async () => {
        const [rows, groups] = await Promise.all([
          dbCustomers.list(),
          dbCustomers.listGroups(),
        ]);
        if (rows.length) set({ customers: rows.map(fromRow) });
        if (groups.length) set({ groups });
      },

      addCustomer: (c) => {
        const created: CustomerRow = { ...c, id: uid() };
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
        set((s) => (s.groups.includes(name) ? s : { groups: [...s.groups, name] }));
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
