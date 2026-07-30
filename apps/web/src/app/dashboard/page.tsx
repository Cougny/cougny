'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SiteHeader } from '@/components/SiteHeader';
import { GamesCard } from '@/components/dashboard/GamesCard';
import { LeaderboardCard } from '@/components/dashboard/LeaderboardCard';
import { useAuth } from '@/components/auth/AuthProvider';
import { ArrowRightIcon, ShieldIcon, SpinnerIcon } from '@/components/icons';

/**
 * The signed-in home: where you go to start a call, pick a game, or see where
 * you stand.
 *
 * Unlike the call screen, which greets visitors with a sign-in card over the
 * stage, this one sends them away — the public landing page is now the front
 * door, so an anonymous hit here is someone who followed a stale link rather
 * than someone discovering the product.
 */
export default function DashboardPage(): React.ReactElement {
  const t = useTranslations('dashboard');
  const router = useRouter();
  const { status, user } = useAuth();

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
    else if (status === 'authenticated' && user && !user.profileComplete) {
      router.replace('/signup/complete');
    }
  }, [status, user, router]);

  if (status !== 'authenticated' || !user || !user.profileComplete) {
    return (
      <div className="flex min-h-dvh flex-col">
        <SiteHeader />
        <div className="flex flex-1 items-center justify-center">
          <SpinnerIcon className="h-8 w-8 animate-spin text-brand" />
        </div>
      </div>
    );
  }

  const name = user.displayName ?? user.username ?? '';

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-white">
          {t('greeting', { name })}
        </h1>
        <p className="pt-2 text-base text-neutral-500 dark:text-neutral-400">{t('subtitle')}</p>

        {/* The one thing this page exists to launch. */}
        <Link
          href="/dashboard/call"
          className="group relative mt-9 flex overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-accent p-8 shadow-[0_18px_40px_-18px_rgba(124,58,237,0.65)] transition hover:scale-[1.01] active:scale-[0.99] sm:p-10"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/15 blur-3xl"
          />
          <span className="relative flex-1">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">
              {t('callEyebrow')}
            </span>
            <span className="block pt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              {t('callTitle')}
            </span>
            <span className="block max-w-md pt-2.5 text-sm leading-relaxed text-white/85">
              {t('callBody')}
            </span>
            <span className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-neutral-900 shadow-md transition group-hover:gap-3">
              {t('callAction')}
              <ArrowRightIcon className="h-4 w-4" />
            </span>
          </span>
        </Link>

        <div className="grid gap-5 pt-6 lg:grid-cols-2">
          <GamesCard />
          <LeaderboardCard />
        </div>

        {/* House rules, kept in view rather than buried in the terms page. */}
        <aside className="mt-6 flex items-start gap-3.5 rounded-2xl border border-neutral-200 bg-white px-5 py-4 dark:border-neutral-800 dark:bg-neutral-900">
          <ShieldIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {t('rulesTitle')}
            </p>
            <p className="pt-1 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
              {t('rulesBody')}
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
