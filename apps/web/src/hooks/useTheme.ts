'use client';

import { useSyncExternalStore } from 'react';

const THEME_STORAGE_KEY = 'cougny.theme';

/*
 * The `dark` class on <html> is the single source of truth (set pre-paint by
 * the root layout's inline script); observing it keeps every toggle instance
 * in sync without extra state.
 */
function subscribeToThemeClass(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

/** Reads and flips the site's light/dark theme, persisting the choice. */
export function useTheme(): { isDark: boolean; toggle: () => void } {
  const isDark = useSyncExternalStore(
    subscribeToThemeClass,
    () => document.documentElement.classList.contains('dark'),
    () => false,
  );

  const toggle = (): void => {
    const next = !isDark;
    document.documentElement.classList.toggle('dark', next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
    } catch {
      // Storage can be unavailable (private mode); the toggle still works for
      // the current visit.
    }
  };

  return { isDark, toggle };
}
