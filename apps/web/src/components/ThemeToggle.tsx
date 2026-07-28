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

/**
 * The app floats this control in its own corner; screens with a layout of
 * their own — the account card, say — pass their own placement so it does not
 * hover over their content.
 */
const FLOATING_CLASS =
  'fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-300 text-neutral-600 shadow-lg transition hover:scale-105 active:scale-95 dark:bg-neutral-700 dark:text-neutral-300';

/** Switches between light (default) and dark, persisting the choice. */
export function ThemeToggle({
  className = FLOATING_CLASS,
}: {
  className?: string;
}): React.ReactElement {
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
      className={className}
    >
      {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  );
}
