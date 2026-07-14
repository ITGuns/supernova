import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Persisted billing details (Setup → Billing): the card on file and the
// billing recipient. Plan/frequency live in setupStore — this store only
// holds the editable payment-details fields.
export interface BillingState {
  cardName: string;
  cardLast4: string;
  cardExpiry: string;
  recipientEmail: string;
  set: (patch: Partial<BillingState>) => void;
}

export const useBilling = create<BillingState>()(
  persist(
    (set) => ({
      cardName: 'Alex Kim',
      cardLast4: '7248',
      cardExpiry: '03 / 2028',
      recipientEmail: 'alex@nova.local',
      set: (patch) => set(patch),
    }),
    { name: 'nova-billing-v1' },
  ),
);
