'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { AuroraField } from '@/components/marketing/AuroraField';
import { KineticHeadline } from '@/components/marketing/KineticHeadline';
import { LiveStage } from '@/components/marketing/LiveStage';
import { MagneticCta } from '@/components/marketing/MagneticCta';
import { Reveal } from '@/components/marketing/Reveal';
import { useAuth } from '@/components/auth/AuthProvider';
import { ArrowRightIcon } from '@/components/icons';

const STEPS = ['one', 'two', 'three'] as const;

/**
 * cougny.com — what the product is, for people who do not have it yet.
 *
 * The app proper lives behind `/dashboard`; this page's whole job is to explain
 * the thing and hand visitors to sign-up. Signed-in visitors get the same page
 * with every call-to-action pointed at the dashboard instead, so the front door
 * never asks someone to sign up twice.
 *
 * Structurally it is deliberately un-boxed. Panels of copy in rounded cards are
 * the house style of every generated marketing page, and stacking six of them
 * reads as filler however well each one is written. What is left is set like a
 * document: one product shot at the top, then rules and space doing the work
 * that borders were doing.
 */
export default function LandingPage(): React.ReactElement {
  const t = useTranslations('landing');
  const tApp = useTranslations('app');
  const tCall = useTranslations('call');
  const tTerms = useTranslations('terms');
  const tAccount = useTranslations('account');
  const { status } = useAuth();

  const signedIn = status === 'authenticated';
  const primaryHref = signedIn ? '/dashboard' : '/signup';
  const primaryLabel = signedIn ? t('navDashboard') : t('ctaPrimary');

  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      {/*
       * `fixed` rather than sized to the hero: a box tall enough to reach the
       * page's end would have to stretch the field's internal blobs (they are
       * sized in percentages of their own container) into shapes far larger
       * than the ones tuned to look right. Pinning it to the viewport instead
       * means the exact same field is simply always there, at every scroll
       * position, right down to the footer — visually continuous without
       * scaling anything.
       */}
      <AuroraField className="fixed inset-0 -z-10" vignette />

      <MarketingHeader />

      <main>
        {/*
         * Claim, centred, with the product shot directly beneath it — read as
         * a single column rather than two things competing for attention side
         * by side. Centring only works because the headline is short enough
         * to sit in two or three balanced lines; a longer claim would need to
         * fall back to a left-aligned block, where ragged-centre reads as
         * unfinished rather than composed.
         *
         * The headline plays a fade-and-rise the instant it is on screen —
         * `Reveal` resolves synchronously for anything already in the
         * viewport on mount, so this is a load-time entrance, not a
         * scroll-triggered one. The shot follows it in on a short delay, so
         * the two arrive as a sequence rather than at once.
         *
         * The hero claims the viewport it is in, less the header. That is what
         * keeps the next section genuinely below the fold: with a short hero,
         * "How it works" starts partway up the first screen, so it is simply
         * *there* on load and its entrance never plays. Sizing to the viewport
         * rather than padding to a guessed height means that holds on a laptop
         * and on a tall monitor alike.
         */}
        <section className="mx-auto flex w-full max-w-[100rem] flex-col items-center gap-12 px-4 pb-20 pt-16 text-center sm:px-8 sm:pt-24 lg:min-h-[calc(100svh-4rem)] lg:justify-center lg:gap-16 lg:pb-28">
          <Reveal variant="up">
            {/*
             * Bold, all-caps, and tracked tighter than the mixed-case version
             * was: capitals carry more visual weight per letter than lowercase,
             * so the same aggressive negative tracking that read as "engineered"
             * on mixed case reads as collision here — this is loosened off that
             * value, not tightened further.
             */}
            <KineticHeadline
              lead={t('heroTitle')}
              accent={t('heroTitleAccent')}
              className="mx-auto max-w-[90rem] text-[clamp(2rem,3.5vw,3.25rem)] font-black uppercase leading-[1.1] tracking-[-0.015em] text-neutral-900 dark:text-white"
            />
          </Reveal>

          {/*
           * Deliberately inert. The product shot is the page's evidence, and
           * evidence that drifts, breathes or catches a travelling light reads
           * as a rendering of the product rather than as the product. It gets
           * one entrance and then holds still; the depth comes from the shadow.
           *
           * No wrapper styling here: `LiveStage`'s own root box already
           * carries its rounded corners, background, and shadow — and now
           * that it centres itself rather than filling a matched-width
           * column, a second full-width ring and shadow around it would
           * frame empty space instead of the card.
           */}
          <Reveal variant="scale" delay={180} className="w-full">
            <LiveStage href={primaryHref} />
          </Reveal>
        </section>

        {/*
         * How it works, set as a document rather than as three cards. A rule
         * between rows separates them as firmly as a border would and costs the
         * page none of the visual noise that six rounded rectangles do.
         */}
        <section id="how" className="mx-auto w-full max-w-[100rem] px-4 py-24 sm:px-8 sm:py-32">
          <Reveal variant="up">
            <div className="max-w-2xl">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand dark:text-violet-300">
                {t('howEyebrow')}
              </span>
              <h2 className="pt-4 text-[clamp(2rem,5vw,3rem)] font-semibold tracking-[-0.035em] text-neutral-900 dark:text-white">
                {t('howTitle')}
              </h2>
              <p className="pt-4 text-base leading-relaxed text-neutral-500 dark:text-neutral-400">
                {t('howBody')}
              </p>
            </div>
          </Reveal>

          <ol className="mt-16 border-t border-neutral-200 dark:border-white/10">
            {STEPS.map((step, index) => (
              <li
                key={step}
                className="border-b border-neutral-200 last:border-b-0 dark:border-white/10"
              >
                {/* Wider stagger than the hero's. Three rows arriving 150ms
                    apart read as a sequence being dealt out; at the hero's
                    52ms they would read as one block with a soft edge. */}
                <Reveal variant="up" delay={150 + index * 150}>
                  <div className="grid gap-4 py-10 sm:grid-cols-[5rem_1fr] sm:gap-8 lg:grid-cols-[5rem_18rem_1fr]">
                    {/* The display face earns its keep here: at this size the
                        numeral is a graphic element, not a label. */}
                    <span className="font-display text-4xl leading-none text-brand dark:text-violet-300">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3 className="text-xl font-semibold tracking-[-0.02em] text-neutral-900 dark:text-white">
                      {t(`steps.${step}.title`)}
                    </h3>
                    <p className="max-w-xl text-base leading-relaxed text-neutral-500 dark:text-neutral-400">
                      {t(`steps.${step}.body`)}
                    </p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        {/* Closing call to action. */}
        <section className="mx-auto w-full max-w-[100rem] px-4 pb-24 sm:px-8 sm:pb-32">
          <Reveal variant="scale">
            <div className="relative isolate overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950 px-8 py-20 text-center sm:px-12 sm:py-24">
              <AuroraField className="absolute inset-0 -z-10" />
              <h2 className="text-[clamp(2rem,5vw,3rem)] font-semibold tracking-[-0.035em] text-white">
                {t('finalTitle')}
              </h2>
              <p className="mx-auto max-w-lg pt-5 text-sm leading-relaxed text-neutral-300 sm:text-base">
                {t('finalBody')}
              </p>
              <div className="flex justify-center pt-8">
                <MagneticCta>
                  <Link
                    href={primaryHref}
                    className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-bold text-neutral-900 shadow-[0_14px_40px_-12px_rgba(255,255,255,0.5)] transition-shadow duration-500"
                  >
                    {primaryLabel}
                    <ArrowRightIcon className="h-4 w-4 transition-transform duration-500 ease-out-back group-hover:translate-x-1" />
                  </Link>
                </MagneticCta>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-neutral-200 dark:border-white/[0.08]">
        <div className="mx-auto flex w-full max-w-[100rem] flex-col items-center justify-between gap-5 px-4 py-9 sm:flex-row sm:px-8">
          <span className="font-display text-xl uppercase leading-none tracking-wide text-neutral-500 dark:text-neutral-400">
            {tApp('name')}
          </span>
          <div className="flex items-center gap-6 text-sm text-neutral-500 dark:text-neutral-400">
            <Link href="/terms" className="transition hover:text-neutral-900 dark:hover:text-white">
              {tTerms('title')}
            </Link>
            {/* Label follows the destination: this used to read "Dashboard"
                while pointing at the login form regardless of sign-in state —
                a bait-and-switch for every signed-out visitor who clicked it. */}
            <Link
              href={signedIn ? '/dashboard' : '/login'}
              className="transition hover:text-neutral-900 dark:hover:text-white"
            >
              {signedIn ? t('navDashboard') : tAccount('signIn')}
            </Link>
          </div>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">{t('footerNote')}</p>
        </div>
      </footer>
    </div>
  );
}
