'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/components/auth/AuthProvider';

/**
 * The public site's top bar.
 *
 * Distinct from `SiteHeader`, which serves signed-in screens: this one carries
 * the section anchors and the two sign-up doors, and it renders for visitors
 * who have no account to put a menu behind. Once someone is signed in, the two
 * buttons collapse into a single way through to the dashboard.
 */
export function MarketingHeader(): React.ReactElement {
  const t = useTranslations('landing');
  const tApp = useTranslations('app');
  const tAccount = useTranslations('account');
  const { status } = useAuth();

  const signedIn = status === 'authenticated';

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200/70 bg-neutral-100/80 backdrop-blur-xl dark:border-neutral-800/70 dark:bg-neutral-950/80">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="font-display text-2xl uppercase leading-none tracking-wide">
          {tApp('name')}
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-neutral-600 md:flex dark:text-neutral-300">
          <a href="#how" className="transition hover:text-neutral-900 dark:hover:text-white">
            {t('navHow')}
          </a>
          <a href="#features" className="transition hover:text-neutral-900 dark:hover:text-white">
            {t('navFeatures')}
          </a>
          <a href="#safety" className="transition hover:text-neutral-900 dark:hover:text-white">
            {t('navSafety')}
          </a>
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/*
           * Nothing is rendered while the initial refresh is in flight: a
           * "Sign in" that turns into "Dashboard" a beat later reads as a bug
           * to someone who never signed out.
           */}
          {status === 'loading' ? null : signedIn ? (
            <Link
              href="/dashboard"
              className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 active:scale-[0.98] dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              {t('navDashboard')}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full px-4 py-2 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-200/70 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
              >
                {tAccount('signIn')}
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 active:scale-[0.98] dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                {t('ctaPrimary')}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
