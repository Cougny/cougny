'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { GAMES } from '@/lib/games';
import { ArrowRightIcon, GameIcon } from '@/components/icons';

/**
 * Things to do once you are in a call.
 *
 * Every mode is unreleased today, so each tile renders as a disabled card with
 * a "coming soon" chip. Flipping `available` in the catalogue turns that same
 * tile into its link — the two states are the same markup so nothing shifts
 * when one ships.
 */
export function GamesCard(): React.ReactElement {
  const t = useTranslations('games');

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <header className="border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-neutral-900 dark:text-white">
          <GameIcon className="h-4 w-4 text-brand dark:text-violet-300" />
          {t('title')}
        </h2>
        <p className="pt-1 text-sm text-neutral-500 dark:text-neutral-400">{t('description')}</p>
      </header>

      <div className="grid gap-3 p-5 sm:grid-cols-2">
        {GAMES.map((game) => {
          const body = (
            <>
              <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {t(`catalogue.${game.id}.title`)}
              </span>
              <span className="pt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                {t(`catalogue.${game.id}.body`)}
              </span>
              <span className="pt-3">
                {game.available ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand dark:text-violet-300">
                    {t('play')}
                    <ArrowRightIcon className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500">
                    {t('comingSoon')}
                  </span>
                )}
              </span>
            </>
          );

          const shared =
            'flex flex-col rounded-xl border p-4 text-left transition border-neutral-200 dark:border-neutral-800';

          return game.available ? (
            <Link
              key={game.id}
              href={game.href}
              className={`${shared} bg-neutral-50 hover:border-brand/40 hover:bg-white hover:shadow-sm dark:bg-neutral-950/40 dark:hover:bg-neutral-950`}
            >
              {body}
            </Link>
          ) : (
            <div
              key={game.id}
              aria-disabled
              className={`${shared} border-dashed bg-neutral-50/60 dark:bg-neutral-950/30`}
            >
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}
