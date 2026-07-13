import { create } from 'zustand';

export type ThemeOverride = 'light' | 'dark' | null;

const KEY = 'nova-theme';

function readInitial(): ThemeOverride {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

interface ThemeState {
  override: ThemeOverride;
  setOverride: (o: ThemeOverride) => void;
}

export const useTheme = create<ThemeState>((set) => ({
  override: readInitial(),
  setOverride: (o) => {
    try {
      if (o) localStorage.setItem(KEY, o);
      else localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    set({ override: o });
  },
}));
