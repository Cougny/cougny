'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ThemeToggle } from '@/components/ThemeToggle';

/** Slim top bar: wordmark on the left, theme switch on the right. */
export function SiteHeader(): React.ReactElement {
  const t = useTranslations('app');

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-100 bg-white/80 px-4 backdrop-blur sm:px-5 dark:border-neutral-800 dark:bg-neutral-950/80">
      <Link href="/" className="flex items-baseline gap-2.5">
        <span className="bg-gradient-to-br from-brand to-brand-accent bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
          {t('name')}
        </span>
        <span className="hidden text-sm text-neutral-400 sm:inline dark:text-neutral-500">
          {t('tagline')}
        </span>
      </Link>
      <ThemeToggle />
    </header>
  );
}
