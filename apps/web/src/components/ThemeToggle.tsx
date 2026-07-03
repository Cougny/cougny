'use client';

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { MoonIcon, SunIcon } from '@/components/icons';

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

/** Switches between light (default) and dark, persisting the choice. */
export function ThemeToggle(): React.ReactElement {
  const t = useTranslations('theme');

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

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? t('switchToLight') : t('switchToDark')}
      title={isDark ? t('switchToLight') : t('switchToDark')}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:text-neutral-100"
    >
      {isDark ? <SunIcon className="h-4.5 w-4.5" /> : <MoonIcon className="h-4.5 w-4.5" />}
    </button>
  );
}
