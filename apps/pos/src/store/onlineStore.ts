import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Persisted online-store settings for the Online back-office page:
// whether the online storefront is enabled and its subdomain.
interface OnlineState {
  enabled: boolean;
  subdomain: string;
  /** AI Showroom: a generated, shareable showcase page for your catalog. */
  showroom: boolean;
  showroomTagline: string;
  set: (patch: Partial<Pick<OnlineState, 'enabled' | 'subdomain' | 'showroom' | 'showroomTagline'>>) => void;
}

export const useOnline = create<OnlineState>()(
  persist(
    (set) => ({
      enabled: false,
      subdomain: 'nova-downtown',
      showroom: false,
      showroomTagline: '',
      set: (patch) => set(patch),
    }),
    { name: 'nova-online-v1' },
  ),
);
