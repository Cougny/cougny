'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { MonitorIcon, MoonIcon, SunIcon } from '@/components/icons';

const THEME_STORAGE_KEY = 'cougny.theme';

type ThemeChoice = 'system' | 'light' | 'dark';

function readStored(): ThemeChoice {
  if (typeof window === 'undefined') return 'system';
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark') return raw;
  } catch {
    // Storage unavailable — fall through.
  }
  return 'system';
}

function resolveEffective(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  const stored = readStored();
  if (stored === 'light') return 'light';
  if (stored === 'dark') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/*
 * The `dark` class on <html> is the single source of truth (set pre-paint by
 * the root layout's inline script). Observing it keeps every toggle instance
 * in sync without extra state.
 */
function subscribeToThemeClass(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  // Also listen for OS theme changes so "system" mode stays live.
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  mql.addEventListener('change', onChange);
  return () => {
    observer.disconnect();
    mql.removeEventListener('change', onChange);
  };
}

/** Cycles: system → light → dark → system. Overrides follow the OS when set to system. */
export function ThemeToggle(): React.ReactElement {
  const t = useTranslations('theme');

  const isDark = useSyncExternalStore(
    subscribeToThemeClass,
    () => document.documentElement.classList.contains('dark'),
    () => false,
  );

  const stored = useSyncExternalStore(
    subscribeToThemeClass,
    readStored,
    () => 'system' as ThemeChoice,
  );

  const cycle = useCallback((): void => {
    const next: ThemeChoice =
      stored === 'system' ? 'light' : stored === 'light' ? 'dark' : 'system';

    try {
      if (next === 'system') {
        window.localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      }
    } catch {
      // Storage unavailable — toggle still works for this visit.
    }

    document.documentElement.classList.toggle(
      'dark',
      next === 'dark' ||
        (next === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches),
    );
  }, [stored]);

  const effective = resolveEffective();

  return (
    <button
      onClick={cycle}
      aria-label={
        stored === 'system'
          ? t('switchToLight')
          : stored === 'light'
            ? t('switchToDark')
            : t('switchToSystem')
      }
      title={
        stored === 'system'
          ? t('switchToLight')
          : stored === 'light'
            ? t('switchToDark')
            : t('switchToSystem')
      }
      className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-white text-neutral-500 shadow-md ring-1 ring-black/5 transition hover:scale-105 hover:text-neutral-700 hover:shadow-lg active:scale-95 dark:bg-neutral-800 dark:text-neutral-400 dark:ring-white/5 dark:hover:text-neutral-200"
    >
      {stored === 'system' ? (
        <MonitorIcon className="h-5 w-5" />
      ) : effective === 'dark' ? (
        <MoonIcon className="h-5 w-5" />
      ) : (
        <SunIcon className="h-5 w-5" />
      )}
    </button>
  );
}
