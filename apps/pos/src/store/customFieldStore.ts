import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbCustomFields } from '../lib/db';

// Setup → Workflows → Custom fields: extra fields your team can fill in on
// customers, products, sales and users.

export type CustomFieldApplication = 'Customers' | 'Products' | 'Sales' | 'Users' | 'Services';
export type CustomFieldType = 'Text' | 'Number' | 'Date' | 'Checkbox' | 'Dropdown';

export interface CustomField {
  id: string;
  name: string;
  application: CustomFieldApplication;
  /** What the field is attached to (e.g. Customer, Product, Sale line). */
  entity: string;
  type: CustomFieldType;
  /** Dropdown choices, one per entry. */
  options: string[];
  createdAt: number;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `cf-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

const toRow = (f: CustomField): Record<string, unknown> => ({
  id: f.id,
  name: f.name,
  application: f.application,
  entity: f.entity,
  type: f.options.length ? `${f.type}:${f.options.join('|')}` : f.type,
  created_at: new Date(f.createdAt).toISOString(),
});

const fromRow = (r: Record<string, unknown>): CustomField => {
  const rawType = (r.type as string) ?? 'Text';
  const [type, opts] = rawType.split(':');
  return {
    id: r.id as string,
    name: (r.name as string) ?? '',
    application: ((r.application as string) || 'Customers') as CustomFieldApplication,
    entity: (r.entity as string) ?? '',
    type: (type || 'Text') as CustomFieldType,
    options: opts ? opts.split('|') : [],
    createdAt: r.created_at ? new Date(r.created_at as string).getTime() : Date.now(),
  };
};

interface CustomFieldState {
  fields: CustomField[];
  syncFromDb: () => Promise<void>;
  addField: (f: Omit<CustomField, 'id' | 'createdAt'>) => CustomField;
  updateField: (id: string, patch: Partial<CustomField>) => void;
  deleteField: (id: string) => void;
}

export const useCustomFields = create<CustomFieldState>()(
  persist(
    (set, get) => ({
      fields: [],
      syncFromDb: async () => {
        const rows = await dbCustomFields.list();
        if (rows === null || rows === 'missing') return;
        set({ fields: rows.map(fromRow) });
      },
      addField: (f) => {
        const created: CustomField = { ...f, id: uid(), createdAt: Date.now() };
        set((s) => ({ fields: [...s.fields, created] }));
        dbCustomFields.upsert(toRow(created));
        return created;
      },
      updateField: (id, patch) => {
        const fields = get().fields.map((f) => (f.id === id ? { ...f, ...patch } : f));
        set({ fields });
        const f = fields.find((x) => x.id === id);
        if (f) dbCustomFields.upsert(toRow(f));
      },
      deleteField: (id) => {
        set((s) => ({ fields: s.fields.filter((f) => f.id !== id) }));
        dbCustomFields.del(id);
      },
    }),
    { name: 'nova-custom-fields-v1' },
  ),
);
