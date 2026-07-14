import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Persisted online-store settings for the Online back-office page:
// whether the online storefront is enabled and its subdomain.
interface OnlineState {
  enabled: boolean;
  subdomain: string;
  set: (patch: Partial<Pick<OnlineState, 'enabled' | 'subdomain'>>) => void;
}

export const useOnline = create<OnlineState>()(
  persist(
    (set) => ({
      enabled: false,
      subdomain: 'nova-downtown',
      set: (patch) => set(patch),
    }),
    { name: 'nova-online-v1' },
  ),
);
