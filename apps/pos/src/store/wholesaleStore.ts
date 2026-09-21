import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Wholesale: the B2B marketplace account this store orders from. Lightspeed
// pairs this section with NuORDER; Nova keeps the same flow against its own
// wholesale marketplace. The link lives on this device, like the register's
// other device-level connections.

export interface WholesaleAccount {
  email: string;
  company: string;
  connectedAt: number;
}

interface WholesaleState {
  account: WholesaleAccount | null;
  connect: (email: string, company: string) => void;
  disconnect: () => void;
}

export const useWholesale = create<WholesaleState>()(
  persist(
    (set) => ({
      account: null,
      connect: (email, company) => set({ account: { email: email.trim(), company: company.trim(), connectedAt: Date.now() } }),
      disconnect: () => set({ account: null }),
    }),
    { name: 'nova-wholesale-v1' },
  ),
);
