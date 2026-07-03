'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ThemeToggle } from '@/components/ThemeToggle';

/** Slim top bar: wordmark on the left, theme switch on the right. */
export function SiteHeader(): React.ReactElement {
  const t = useTranslations('app');

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-5 dark:border-neutral-800 dark:bg-neutral-950">
      <Link href="/" className="flex items-baseline gap-2.5">
        <span className="bg-gradient-to-br from-brand to-brand-accent bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
          {t('name')}
        </span>
        <span className="hidden text-sm text-neutral-500 sm:inline dark:text-neutral-400">
          {t('tagline')}
        </span>
      </Link>
      <ThemeToggle />
    </header>
  );
}
