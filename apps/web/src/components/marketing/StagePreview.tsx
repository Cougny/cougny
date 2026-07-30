'use client';

import { useTranslations } from 'next-intl';
import { MatchControls } from '@/components/MatchControls';
import { VideoPanel } from '@/components/VideoPanel';
import { UserIcon } from '@/components/icons';

/** Stable identity, so the controls' preference effect does not re-fire. */
const noop = (): void => undefined;

/**
 * The call screen, sitting in the landing page's hero.
 *
 * Built from the components the call screen itself uses rather than from a
 * screenshot, so the picture on the front page cannot fall behind the product.
 * `inert` keeps the whole replica out of the accessibility tree and the tab
 * order — it is an illustration, and the page's real controls are the links
 * around it.
 */
export function StagePreview(): React.ReactElement {
  const t = useTranslations('call');
  const tApp = useTranslations('app');

  return (
    <div
      inert
      aria-hidden
      className="pointer-events-none aspect-[16/10] w-full select-none overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-950"
    >
      <div className="grid h-full w-full grid-rows-[70fr_30fr]">
        <div className="flex min-h-0 gap-3 overflow-hidden p-3">
          <VideoPanel label={t('you')}>
            <div className="flex h-full w-full items-center justify-center">
              <UserIcon className="h-10 w-10 text-neutral-300 dark:text-neutral-600" />
            </div>
            <span className="absolute left-3 top-3 font-display text-2xl uppercase text-neutral-400/50">
              {tApp('name')}
            </span>
          </VideoPanel>

          <VideoPanel label={t('stranger')}>
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
              <UserIcon className="h-10 w-10 text-neutral-300 dark:text-neutral-600" />
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('idleHint')}</p>
            </div>
          </VideoPanel>
        </div>

        <div className="overflow-hidden border-t border-neutral-200/50 dark:border-neutral-800">
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
  );
}
