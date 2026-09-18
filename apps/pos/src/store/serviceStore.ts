import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dbServiceStatuses, dbServices } from '../lib/db';
import type { CartLine } from './cartStore';

// Services (repairs, fittings, jobs): created from the register or the
// Services page, moved through statuses, annotated with notes, and finally
// rung up as a sale.

export interface ServiceItem {
  name: string;
  serial: string;
  description: string;
  condition: string;
}

export interface ServiceNote {
  id: string;
  text: string;
  by: string;
  at: number;
  visibleToCustomer: boolean;
}

export interface ServiceStatus {
  id: string;
  name: string;
  position: number;
  system: boolean;
}

export const DEFAULT_STATUSES: ServiceStatus[] = [
  { id: 'new', name: 'New', position: 0, system: true },
  { id: 'ready', name: 'Ready To Start', position: 1, system: false },
  { id: 'in-progress', name: 'In Progress', position: 2, system: false },
  { id: 'awaiting-customer', name: 'Awaiting Customer', position: 3, system: false },
  { id: 'awaiting-part', name: 'Awaiting Part', position: 4, system: false },
  { id: 'completed', name: 'Completed', position: 98, system: true },
  { id: 'cancelled', name: 'Cancelled', position: 99, system: true },
];

export interface Service {
  id: string;
  number: string;
  customerName: string;
  item: ServiceItem;
  /** Status name (matches ServiceStatus.name). */
  status: string;
  assignedUser: string;
  location: string;
  description: string;
  durationMin: number;
  scheduledAt: number | null;
  notes: ServiceNote[];
  /** Products / service charges to ring up when the service is completed. */
  lines: CartLine[];
  saleOrderNumber: string;
  createdAt: number;
  completedAt: number | null;
}

export const isCurrentService = (s: Service): boolean => s.status !== 'Completed' && s.status !== 'Cancelled';

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `svc-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

const toRow = (s: Service): Record<string, unknown> => ({
  id: s.id,
  number: s.number,
  customer_name: s.customerName,
  item: s.item,
  status: s.status,
  assigned_user: s.assignedUser,
  location: s.location,
  description: s.description,
  duration_min: s.durationMin,
  scheduled_at: s.scheduledAt ? new Date(s.scheduledAt).toISOString() : null,
  notes: s.notes,
  lines: s.lines,
  sale_order_number: s.saleOrderNumber || null,
  created_at: new Date(s.createdAt).toISOString(),
  completed_at: s.completedAt ? new Date(s.completedAt).toISOString() : null,
});

const fromRow = (r: Record<string, unknown>): Service => ({
  id: r.id as string,
  number: (r.number as string) ?? '',
  customerName: (r.customer_name as string) ?? '',
  item: { name: '', serial: '', description: '', condition: '', ...((r.item as Partial<ServiceItem> | null) ?? {}) },
  status: (r.status as string) || 'New',
  assignedUser: (r.assigned_user as string) ?? '',
  location: (r.location as string) ?? '',
  description: (r.description as string) ?? '',
  durationMin: Number(r.duration_min ?? 0),
  scheduledAt: r.scheduled_at ? new Date(r.scheduled_at as string).getTime() : null,
  notes: (r.notes as ServiceNote[] | null) ?? [],
  lines: (r.lines as CartLine[] | null) ?? [],
  saleOrderNumber: (r.sale_order_number as string | null) ?? '',
  createdAt: r.created_at ? new Date(r.created_at as string).getTime() : Date.now(),
  completedAt: r.completed_at ? new Date(r.completed_at as string).getTime() : null,
});

const statusToRow = (s: ServiceStatus): Record<string, unknown> => ({ id: s.id, name: s.name, position: s.position, system: s.system });
const statusFromRow = (r: Record<string, unknown>): ServiceStatus => ({ id: r.id as string, name: r.name as string, position: Number(r.position ?? 0), system: !!r.system });

interface ServiceState {
  services: Service[];
  statuses: ServiceStatus[];
  nextSeq: number;
  syncFromDb: () => Promise<void>;
  addService: (s: Omit<Service, 'id' | 'number' | 'createdAt' | 'completedAt' | 'notes'> & { notes?: ServiceNote[] }) => Service;
  updateService: (id: string, patch: Partial<Service>) => void;
  setStatus: (id: string, status: string) => void;
  addNote: (id: string, text: string, by: string, visibleToCustomer: boolean) => void;
  deleteService: (id: string) => void;
  addStatus: (name: string) => void;
  renameStatus: (id: string, name: string) => void;
  deleteStatus: (id: string) => void;
}

export const useServices = create<ServiceState>()(
  persist(
    (set, get) => ({
      services: [],
      statuses: DEFAULT_STATUSES,
      nextSeq: 1001,
      syncFromDb: async () => {
        const [rows, statusRows] = await Promise.all([dbServices.list(), dbServiceStatuses.list()]);
        if (rows !== null && rows !== 'missing') {
          const services = rows.map(fromRow);
          const maxSeq = services.reduce((m, s) => Math.max(m, parseInt(s.number.replace(/\D/g, ''), 10) || 0), 1000);
          set({ services, nextSeq: Math.max(get().nextSeq, maxSeq + 1) });
        }
        if (statusRows !== null && statusRows !== 'missing' && statusRows.length) set({ statuses: statusRows.map(statusFromRow).sort((a, b) => a.position - b.position) });
      },
      addService: (s) => {
        const seq = get().nextSeq;
        const created: Service = { ...s, notes: s.notes ?? [], id: uid(), number: `S-${seq}`, createdAt: Date.now(), completedAt: null };
        set((st) => ({ services: [created, ...st.services], nextSeq: seq + 1 }));
        dbServices.upsert(toRow(created));
        return created;
      },
      updateService: (id, patch) => {
        const services = get().services.map((s) => (s.id === id ? { ...s, ...patch } : s));
        set({ services });
        const s = services.find((x) => x.id === id);
        if (s) dbServices.upsert(toRow(s));
      },
      setStatus: (id, status) => {
        get().updateService(id, { status, completedAt: status === 'Completed' || status === 'Cancelled' ? Date.now() : null });
      },
      addNote: (id, text, by, visibleToCustomer) => {
        const s = get().services.find((x) => x.id === id);
        if (!s) return;
        get().updateService(id, { notes: [...s.notes, { id: uid(), text, by, at: Date.now(), visibleToCustomer }] });
      },
      deleteService: (id) => {
        set((st) => ({ services: st.services.filter((s) => s.id !== id) }));
        dbServices.del(id);
      },
      addStatus: (name) => {
        const position = Math.max(0, ...get().statuses.filter((s) => !s.system || s.id === 'new').map((s) => s.position)) + 1;
        const created: ServiceStatus = { id: uid(), name, position, system: false };
        set((st) => ({ statuses: [...st.statuses, created].sort((a, b) => a.position - b.position) }));
        dbServiceStatuses.upsert(statusToRow(created));
      },
      renameStatus: (id, name) => {
        const old = get().statuses.find((s) => s.id === id);
        if (!old || old.system) return;
        const statuses = get().statuses.map((s) => (s.id === id ? { ...s, name } : s));
        // Services carry the status by name, so rename them along with it.
        const services = get().services.map((s) => (s.status === old.name ? { ...s, status: name } : s));
        set({ statuses, services });
        dbServiceStatuses.upsert(statusToRow({ ...old, name }));
        services.filter((s) => s.status === name).forEach((s) => dbServices.upsert(toRow(s)));
      },
      deleteStatus: (id) => {
        const old = get().statuses.find((s) => s.id === id);
        if (!old || old.system) return;
        set((st) => ({ statuses: st.statuses.filter((s) => s.id !== id), services: st.services.map((s) => (s.status === old.name ? { ...s, status: 'New' } : s)) }));
        dbServiceStatuses.del(id);
      },
    }),
    { name: 'nova-services-v1' },
  ),
);
