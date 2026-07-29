'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { StagePreview } from '@/components/marketing/StagePreview';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  ArrowRightIcon,
  BoltIcon,
  ChatIcon,
  GameIcon,
  ShieldIcon,
  TrophyIcon,
  UserIcon,
} from '@/components/icons';

/** Feature cards, in the order they read down the page. */
const FEATURES = [
  { id: 'instant', Icon: BoltIcon },
  { id: 'private', Icon: ShieldIcon },
  { id: 'filters', Icon: UserIcon },
  { id: 'chat', Icon: ChatIcon },
  { id: 'games', Icon: GameIcon },
  { id: 'leaderboard', Icon: TrophyIcon },
] as const;

const STEPS = ['one', 'two', 'three'] as const;

/**
 * cougny.com — what the product is, for people who do not have it yet.
 *
 * The app proper lives behind `/dashboard`; this page's whole job is to explain
 * the thing and hand visitors to sign-up. Signed-in visitors get the same page
 * with every call-to-action pointed at the dashboard instead, so the front door
 * never asks someone to sign up twice.
 */
export default function LandingPage(): React.ReactElement {
  const t = useTranslations('landing');
  const tApp = useTranslations('app');
  const tCall = useTranslations('call');
  const tTerms = useTranslations('terms');
  const { status } = useAuth();

  const signedIn = status === 'authenticated';
  const primaryHref = signedIn ? '/dashboard' : '/signup';
  const primaryLabel = signedIn ? t('navDashboard') : t('ctaPrimary');

  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      {/*
       * Ambient wash behind the hero only. It sits under the content and is
       * clipped by the page, so nothing below the fold picks up a stray glow.
       */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px] overflow-hidden"
      >
        <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-brand/20 blur-[120px] dark:bg-brand/25" />
        <div className="absolute -top-24 right-[8%] h-[360px] w-[420px] rounded-full bg-brand-accent/15 blur-[110px] dark:bg-brand-accent/20" />
      </div>

      <MarketingHeader />

      <main>
        {/* Hero. */}
        <section className="mx-auto w-full max-w-6xl px-5 pb-8 pt-16 sm:px-8 sm:pb-14 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-neutral-300/70 bg-white/70 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-600 backdrop-blur dark:border-neutral-700/70 dark:bg-neutral-900/70 dark:text-neutral-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {t('badge')}
            </span>

            <h1 className="pt-7 text-4xl font-extrabold leading-[1.08] tracking-tight text-neutral-900 sm:text-6xl dark:text-white">
              {t('heroTitle')}{' '}
              <span className="bg-gradient-to-br from-brand to-brand-accent bg-clip-text text-transparent">
                {t('heroTitleAccent')}
              </span>
            </h1>

            <p className="mx-auto max-w-xl pt-6 text-base leading-relaxed text-neutral-600 sm:text-lg dark:text-neutral-300">
              {t('heroBody')}
            </p>

            <div className="flex flex-col items-center justify-center gap-3 pt-9 sm:flex-row">
              <Link
                href={primaryHref}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-brand to-brand-accent px-7 py-3.5 text-sm font-bold text-brand-fg shadow-[0_10px_28px_-8px_rgba(124,58,237,0.6)] transition hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
              >
                {primaryLabel}
                <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#how"
                className="inline-flex w-full items-center justify-center rounded-full border border-neutral-300 bg-white/70 px-7 py-3.5 text-sm font-semibold text-neutral-700 backdrop-blur transition hover:bg-white active:scale-[0.98] sm:w-auto dark:border-neutral-700 dark:bg-neutral-900/70 dark:text-neutral-200 dark:hover:bg-neutral-900"
              >
                {t('ctaSecondary')}
              </a>
            </div>

            <p className="pt-5 text-xs text-neutral-500 dark:text-neutral-400">{t('heroTrust')}</p>
          </div>

          {/* The product itself, shown rather than described. */}
          <div className="pt-14 sm:pt-20">
            <div className="mx-auto max-w-4xl rounded-3xl border border-neutral-200/80 bg-white/70 p-2 shadow-[0_30px_60px_-30px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-900/60 dark:shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9)]">
              <StagePreview />
            </div>
          </div>
        </section>

        {/* How it works. */}
        <section id="how" className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <SectionHeading eyebrow={t('howEyebrow')} title={t('howTitle')} body={t('howBody')} />

          <ol className="grid gap-5 pt-14 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li
                key={step}
                className="rounded-2xl border border-neutral-200 bg-white p-7 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-accent text-sm font-bold text-brand-fg">
                  {index + 1}
                </span>
                <h3 className="pt-5 text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">
                  {t(`steps.${step}.title`)}
                </h3>
                <p className="pt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {t(`steps.${step}.body`)}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Features. */}
        <section
          id="features"
          className="border-y border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900/40"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <SectionHeading
              eyebrow={t('featuresEyebrow')}
              title={t('featuresTitle')}
              body={t('featuresBody')}
            />

            <div className="grid gap-5 pt-14 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ id, Icon }) => (
                <article
                  key={id}
                  className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-7 transition hover:border-brand/40 hover:shadow-[0_12px_30px_-18px_rgba(124,58,237,0.55)] dark:border-neutral-800 dark:bg-neutral-950/40"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand dark:bg-brand/15 dark:text-violet-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="pt-5 text-base font-semibold tracking-tight text-neutral-900 dark:text-white">
                    {t(`features.${id}.title`)}
                  </h3>
                  <p className="pt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                    {t(`features.${id}.body`)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Safety. The one section that speaks plainly rather than selling. */}
        <section id="safety" className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid items-center gap-10 rounded-3xl border border-neutral-200 bg-white p-8 sm:p-12 lg:grid-cols-[auto_1fr] dark:border-neutral-800 dark:bg-neutral-900">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldIcon className="h-7 w-7" />
            </span>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl dark:text-white">
                {t('safetyTitle')}
              </h2>
              <p className="max-w-2xl pt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                {tCall('adultsOnlyNotice')}
              </p>
              <Link
                href="/terms"
                className="inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-brand transition hover:gap-2.5 dark:text-violet-300"
              >
                {t('safetyLink')}
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Closing call to action. */}
        <section className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-8 sm:pb-32">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-accent px-8 py-16 text-center sm:px-12 sm:py-20">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/15 blur-3xl"
            />
            <h2 className="relative text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              {t('finalTitle')}
            </h2>
            <p className="relative mx-auto max-w-lg pt-4 text-sm leading-relaxed text-white/85 sm:text-base">
              {t('finalBody')}
            </p>
            <Link
              href={primaryHref}
              className="relative mt-9 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-bold text-neutral-900 shadow-lg transition hover:scale-[1.02] active:scale-[0.98]"
            >
              {primaryLabel}
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-5 px-5 py-9 sm:flex-row sm:px-8">
          <span className="font-display text-xl uppercase leading-none tracking-wide text-neutral-500 dark:text-neutral-400">
            {tApp('name')}
          </span>
          <div className="flex items-center gap-6 text-sm text-neutral-500 dark:text-neutral-400">
            <Link href="/terms" className="transition hover:text-neutral-900 dark:hover:text-white">
              {tTerms('title')}
            </Link>
            <Link href="/login" className="transition hover:text-neutral-900 dark:hover:text-white">
              {t('navDashboard')}
            </Link>
          </div>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">{t('footerNote')}</p>
        </div>
      </footer>

      <ThemeToggle />
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}): React.ReactElement {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand dark:text-violet-300">
        {eyebrow}
      </span>
      <h2 className="pt-4 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-white">
        {title}
      </h2>
      <p className="pt-4 text-base leading-relaxed text-neutral-600 dark:text-neutral-300">
        {body}
      </p>
    </div>
  );
}
