/**
 * themeStore.ts
 *
 * Manages light / dark / system theme preference.
 *
 * Logic:
 *  - 'light' / 'dark'  → user has explicitly chosen, saved to localStorage
 *  - 'system'          → follow OS preference via matchMedia
 *
 * The store applies the `dark` class to <html> immediately on every change
 * so Tailwind's `dark:` variants activate correctly.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  /** The resolved value — always 'light' or 'dark', never 'system' */
  resolved: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
}

// ── Helpers ──────────────────────────────────────────────────

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolve(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? getSystemTheme() : mode;
}

function applyTheme(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

// ── Store ─────────────────────────────────────────────────────

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'system',
      resolved: resolve('system'),

      setMode: (mode) => {
        const resolved = resolve(mode);
        applyTheme(resolved);
        set({ mode, resolved });
      },
    }),
    {
      name: 'shophub-theme',
      // Only persist the user's chosen mode, not the resolved value
      partialize: (state) => ({ mode: state.mode }),
      // After rehydration, re-apply the theme to <html>
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const resolved = resolve(state.mode);
        applyTheme(resolved);
        state.resolved = resolved;
      },
    }
  )
);

// ── System preference listener ────────────────────────────────
// Runs once at module load. When the OS theme changes and the user
// is on 'system' mode, update the resolved value + DOM class.

if (typeof window !== 'undefined') {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', () => {
    const { mode, setMode } = useThemeStore.getState();
    if (mode === 'system') {
      // Re-trigger setMode('system') to re-resolve and re-apply
      setMode('system');
    }
  });
}
