import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Setup → Workflows → Business rules / Events, and Setup → Fulfillments.
// Kept on this device (no cloud table yet): rules run in the register when
// their event fires.

export type WorkflowEvent = 'Sale completed' | 'Sale parked' | 'Customer added' | 'Product low on stock' | 'Register closed' | 'Refund processed';
export type WorkflowAction = 'Show a message to the cashier' | 'Add a note to the sale' | 'Email the account owner' | 'Require a manager to approve';

export const WORKFLOW_EVENTS: { name: WorkflowEvent; description: string }[] = [
  { name: 'Sale completed', description: 'A sale is paid in full at the register.' },
  { name: 'Sale parked', description: 'A sale is put on hold to finish later.' },
  { name: 'Customer added', description: 'A new customer profile is created.' },
  { name: 'Product low on stock', description: 'Stock on hand falls to a product’s reorder point.' },
  { name: 'Register closed', description: 'A register closure is completed.' },
  { name: 'Refund processed', description: 'Items are returned and a refund is given.' },
];
export const WORKFLOW_ACTIONS: WorkflowAction[] = ['Show a message to the cashier', 'Add a note to the sale', 'Email the account owner', 'Require a manager to approve'];

export interface BusinessRule {
  id: string;
  name: string;
  event: WorkflowEvent;
  /** Optional condition text, e.g. "sale total over $500". */
  condition: string;
  action: WorkflowAction;
  message: string;
  enabled: boolean;
  createdAt: number;
}

export interface FulfillmentSettings {
  sellAcrossStores: boolean;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  pickupInstructions: string;
  deliveryFeeMinor: number;
  readyNotification: boolean;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `wf-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

interface WorkflowState {
  rules: BusinessRule[];
  fulfillment: FulfillmentSettings;
  addRule: (r: Omit<BusinessRule, 'id' | 'createdAt'>) => void;
  updateRule: (id: string, patch: Partial<BusinessRule>) => void;
  deleteRule: (id: string) => void;
  setFulfillment: (patch: Partial<FulfillmentSettings>) => void;
}

export const useWorkflows = create<WorkflowState>()(
  persist(
    (set) => ({
      rules: [],
      fulfillment: { sellAcrossStores: false, pickupEnabled: true, deliveryEnabled: true, pickupInstructions: '', deliveryFeeMinor: 0, readyNotification: true },
      addRule: (r) => set((s) => ({ rules: [...s.rules, { ...r, id: uid(), createdAt: Date.now() }] })),
      updateRule: (id, patch) => set((s) => ({ rules: s.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
      deleteRule: (id) => set((s) => ({ rules: s.rules.filter((r) => r.id !== id) })),
      setFulfillment: (patch) => set((s) => ({ fulfillment: { ...s.fulfillment, ...patch } })),
    }),
    { name: 'nova-workflows-v1' },
  ),
);
