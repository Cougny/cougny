'use client';

import { useEffect } from 'react';

const KEY = 'cougny.theme';

/**
 * Ensures the dark class stays applied after hydration.
 * The inline script handles pre-paint; this handles post-hydration persistence.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(KEY);
      if (stored === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (stored === 'light') {
        document.documentElement.classList.remove('dark');
      }
    } catch {
      // localStorage unavailable — ignore.
    }
  }, []);

  return <>{children}</>;
}
