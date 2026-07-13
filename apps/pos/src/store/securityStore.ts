import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Store-wide security settings. Persisted across navigation, and consumed by the
// app (e.g. "Switching user accounts" gates the profile drawer's Switch user).
interface SecurityState {
  loginAccess: string;
  switching: string; // 'never' | 'barcode' | 'privileges' | 'always'
  authMethod: string;
  inactivity: boolean;
  managerLogin: string;
  managerAuth: string;
  cashierLogin: string;
  cashierAuth: string;
  set: (patch: Partial<SecurityState>) => void;
}

export const useSecurity = create<SecurityState>()(
  persist(
    (set) => ({
      loginAccess: 'has',
      switching: 'privileges',
      authMethod: 'userpass',
      inactivity: false,
      managerLogin: 'default',
      managerAuth: 'default',
      cashierLogin: 'default',
      cashierAuth: 'default',
      set: (patch) => set(patch),
    }),
    { name: 'nova-security-v2' },
  ),
);
