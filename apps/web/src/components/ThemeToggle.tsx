'use client';

import { useTranslations } from 'next-intl';
import { MoonIcon, SunIcon } from '@/components/icons';
import { useTheme } from '@/hooks/useTheme';

/** Switches between light (default) and dark, persisting the choice. */
export function ThemeToggle(): React.ReactElement {
  const t = useTranslations('theme');
  const { isDark, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? t('switchToLight') : t('switchToDark')}
      title={isDark ? t('switchToLight') : t('switchToDark')}
      className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-300 text-neutral-600 shadow-lg transition hover:scale-105 active:scale-95 dark:bg-neutral-700 dark:text-neutral-300"
    >
      {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  );
}
