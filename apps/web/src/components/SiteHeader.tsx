'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AccountMenu } from '@/components/auth/AccountMenu';

/**
 * Slim top bar: wordmark on the left, account controls and theme on the right.
 *
 * Only signed-in screens mount this, so the wordmark goes to the call screen
 * rather than the public landing page — someone with an account has already
 * read the pitch.
 *
 * Translucent rather than filled, like the marketing header: the account page
 * puts an aurora field behind it, and a solid white band across the top of
 * that reads as a strip of some other page laid over this one.
 */
export function SiteHeader(): React.ReactElement {
  const t = useTranslations('app');

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-neutral-200/70 bg-white/70 px-4 backdrop-blur-2xl sm:px-5 dark:border-neutral-800/70 dark:bg-neutral-950/60">
      <Link href="/call" className="flex items-baseline gap-3">
        {/* The brand face, as on the marketing header and the sign-in card.
            The gradient-filled sans this used to be is the one place the old
            wordmark survived, and two marks for one product is one too many. */}
        <span className="font-display text-xl uppercase leading-none tracking-wide text-neutral-900 dark:text-white">
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
