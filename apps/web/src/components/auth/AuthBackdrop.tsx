'use client';

import { useTranslations } from 'next-intl';
import { MatchControls } from '@/components/MatchControls';
import { SiteHeader } from '@/components/SiteHeader';
import { VideoPanel } from '@/components/VideoPanel';
import { UserIcon } from '@/components/icons';

/** Stable identity, so the controls' preference effect does not re-fire. */
const noop = (): void => undefined;

/**
 * The Cougny call screen, one pane of frosted glass away.
 *
 * This is the real interface — the same header, stage panels, and controls the
 * app renders — held in the idle state a visitor would meet on the other side
 * of sign-up, then blurred and dimmed. Building it from the actual components
 * rather than a drawing of them means it cannot drift out of date, and what
 * someone sees behind the card is genuinely what they are signing up for.
 *
 * `inert` is what makes that safe: the tree keeps its markup but leaves the
 * accessibility tree and the tab order entirely, so the card floating above is
 * the only thing anyone can read or reach.
 */
export function AuthBackdrop(): React.ReactElement {
  const t = useTranslations('call');
  const tApp = useTranslations('app');

  return (
    <div
      inert
      aria-hidden
      className="pointer-events-none fixed inset-0 select-none overflow-hidden bg-neutral-100 motion-safe:animate-auth-backdrop dark:bg-neutral-950"
    >
      {/*
       * Scaled up slightly so the blur radius has material to sample past every
       * edge — without it the frame reads as a soft grey border.
       */}
      <div className="absolute inset-0 scale-105 blur-[5px]">
        <div className="grid h-full w-full grid-rows-[auto_1fr_auto] sm:grid-rows-[auto_70fr_30fr]">
          <SiteHeader />

          <div className="flex min-h-0 flex-col gap-3 overflow-hidden p-3 sm:flex-row">
            <VideoPanel label={t('you')}>
              <div className="flex h-full w-full items-center justify-center">
                <UserIcon className="h-12 w-12 text-neutral-300 dark:text-neutral-600" />
              </div>
              <span className="pointer-events-none absolute left-3 top-3 z-10 select-none font-display text-3xl uppercase text-neutral-400/50">
                {tApp('name')}
              </span>
            </VideoPanel>

            <VideoPanel label={t('stranger')}>
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
                <UserIcon className="h-12 w-12 text-neutral-300 dark:text-neutral-600" />
                <p className="text-base text-neutral-500 dark:text-neutral-400">{t('idleHint')}</p>
              </div>
            </VideoPanel>
          </div>

          <div className="overflow-hidden border-t border-neutral-200/50 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950">
            <MatchControls
              status="idle"
              onStart={noop}
              onSkip={noop}
              onStop={noop}
              onPreferencesChange={noop}
            />
          </div>
        </div>
      </div>

      {/* Brand wash, to keep a screen made of neutrals from reading as grey. */}
      <div className="absolute -left-40 -top-48 h-[36rem] w-[36rem] rounded-full bg-brand/20 blur-3xl dark:bg-brand/20" />
      <div className="absolute -bottom-52 -right-36 h-[32rem] w-[32rem] rounded-full bg-brand-accent/15 blur-3xl dark:bg-brand-accent/15" />

      {/*
       * Scrim. It dims rather than washes out, the way a dialog dims the page
       * it covers: a light card needs something darker behind it, and the
       * card's contrast cannot depend on which part of the layout happens to
       * fall behind it.
       */}
      <div className="absolute inset-0 bg-neutral-900/20 dark:bg-neutral-950/50" />
    </div>
  );
}
