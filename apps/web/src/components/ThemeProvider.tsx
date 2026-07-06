'use client';

import { useEffect } from 'react';

const KEY = 'cougny.theme';

/**
 * Syncs the `dark` class on <html> after hydration.
 *
 * Priority: stored 'dark' / 'light' choice → OS `prefers-color-scheme` → light fallback.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  useEffect(() => {
    const stored = ((): string | null => {
      try {
        return window.localStorage.getItem(KEY);
      } catch {
        return null;
      }
    })();

    const preferDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (stored === 'dark' || (!stored && preferDark)) {
      document.documentElement.classList.add('dark');
    } else if (stored === 'light' || (!stored && !preferDark)) {
      document.documentElement.classList.remove('dark');
    } else {
      // stored === 'dark' → add, stored === 'light' → remove
      document.documentElement.classList.toggle('dark', stored === 'dark');
    }
  }, []);

  return <>{children}</>;
}
