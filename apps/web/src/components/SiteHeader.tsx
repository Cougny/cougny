'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AccountMenu } from '@/components/auth/AccountMenu';

/**
 * Slim top bar: wordmark on the left, account controls and theme on the right.
 *
 * Only signed-in screens mount this, so the wordmark goes to the dashboard
 * rather than the public landing page — someone with an account has already
 * read the pitch.
 */
export function SiteHeader(): React.ReactElement {
  const t = useTranslations('app');

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-5 dark:border-neutral-800 dark:bg-neutral-950">
      <Link href="/dashboard" className="flex items-baseline gap-2.5">
        <span className="bg-gradient-to-br from-brand to-brand-accent bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
          {t('name')}
        </span>
        <span className="hidden text-sm text-neutral-500 sm:inline dark:text-neutral-400">
          {t('tagline')}
        </span>
      </Link>
      <div className="flex items-center gap-2">
        <AccountMenu />
        <ThemeToggle />
      </div>
    </header>
  );
}
