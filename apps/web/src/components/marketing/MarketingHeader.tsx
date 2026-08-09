'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/components/auth/AuthProvider';
import { useTheme } from '@/hooks/useTheme';
import { MoonIcon, SunIcon } from '@/components/icons';

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
  const tTheme = useTranslations('theme');
  const { status } = useAuth();
  const { isDark, toggle } = useTheme();

  const signedIn = status === 'authenticated';

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200/70 bg-neutral-100/30 backdrop-blur-2xl dark:border-neutral-800/70 dark:bg-neutral-950/30">
      <div className="mx-auto flex h-16 w-full max-w-[100rem] items-center justify-between px-4 sm:px-8">
        <Link
          href="/"
          className="font-display text-lg uppercase leading-none tracking-wide sm:text-2xl"
        >
          {tApp('name')}
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-neutral-600 md:flex dark:text-neutral-300">
          <a href="#how" className="transition hover:text-neutral-900 dark:hover:text-white">
            {t('navHow')}
          </a>
          <a href="#safety" className="transition hover:text-neutral-900 dark:hover:text-white">
            {t('navSafety')}
          </a>
        </nav>

        <div className="flex items-center gap-0.5 sm:gap-2">
          {/*
           * Inline rather than the floating button the rest of the app uses:
           * this header already has a row for it to sit in, and a fixed
           * circle drifting over the hero on every scroll position is the
           * opposite of the restraint the rest of this page is going for.
           */}
          <button
            onClick={toggle}
            aria-label={isDark ? tTheme('switchToLight') : tTheme('switchToDark')}
            title={isDark ? tTheme('switchToLight') : tTheme('switchToDark')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-600 transition hover:bg-neutral-200/70 hover:text-neutral-900 active:scale-95 sm:h-9 sm:w-9 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
          >
            {isDark ? (
              <SunIcon className="h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]" />
            ) : (
              <MoonIcon className="h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]" />
            )}
          </button>

          {/*
           * Nothing is rendered while the initial refresh is in flight: a
           * "Sign in" that turns into "Dashboard" a beat later reads as a bug
           * to someone who never signed out.
           */}
          {status === 'loading' ? null : signedIn ? (
            <Link
              href="/dashboard"
              className="whitespace-nowrap rounded-full bg-neutral-900 px-2.5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 active:scale-[0.98] sm:px-5 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              {t('navDashboard')}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="whitespace-nowrap rounded-full px-2 py-2 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-200/70 hover:text-neutral-900 sm:px-4 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
              >
                {tAccount('signIn')}
              </Link>
              <Link
                href="/signup"
                className="whitespace-nowrap rounded-full bg-neutral-900 px-2.5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 active:scale-[0.98] sm:px-5 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
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
