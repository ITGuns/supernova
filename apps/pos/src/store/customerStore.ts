import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CustomerRow } from '../data/customers';

// Persisted customers, shared across the Customers page, the register
// (attach a customer to a sale) and reporting (store credit / loyalty).
interface CustomerState {
  customers: CustomerRow[];
  groups: string[];
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

export const useCustomers = create<CustomerState>()(
  persist(
    (set) => ({
      customers: [],
      groups: ['All Customers', 'VIP', 'Wholesale'],
      addCustomer: (c) => {
        const created: CustomerRow = { ...c, id: uid() };
        set((s) => ({ customers: [created, ...s.customers] }));
        return created;
      },
      updateCustomer: (id, patch) =>
        set((s) => ({ customers: s.customers.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      deleteCustomer: (id) => set((s) => ({ customers: s.customers.filter((x) => x.id !== id) })),
      addGroup: (name) =>
        set((s) => (s.groups.includes(name) ? s : { groups: [...s.groups, name] })),
      deleteGroup: (name) =>
        set((s) =>
          name === 'All Customers' ? s : { groups: s.groups.filter((g) => g !== name) },
        ),
    }),
    { name: 'nova-customers-v1' },
  ),
);
