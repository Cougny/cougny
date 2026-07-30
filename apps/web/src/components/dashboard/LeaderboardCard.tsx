'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { fetchLeaderboard, type LeaderboardEntry, type LeaderboardPeriod } from '@/lib/leaderboard';
import { SpinnerIcon, TrophyIcon } from '@/components/icons';

const PERIODS: readonly LeaderboardPeriod[] = ['week', 'allTime'];

/** Medal tints for the top three; everyone else gets the plain rank. */
const PODIUM: Record<number, string> = {
  1: 'bg-amber-400/20 text-amber-700 dark:text-amber-300',
  2: 'bg-neutral-400/20 text-neutral-600 dark:text-neutral-300',
  3: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
};

/**
 * Who is talking to the most people.
 *
 * Ranks come from `fetchLeaderboard`, which is a placeholder until the API
 * grows the endpoint; nothing in this component assumes that.
 */
export function LeaderboardCard(): React.ReactElement {
  const t = useTranslations('leaderboard');
  const [period, setPeriod] = useState<LeaderboardPeriod>('week');

  /*
   * Rows are cached per period rather than replaced, so switching back to a tab
   * you have already seen is instant and the effect never has to blank the list
   * on its way in.
   */
  const [rows, setRows] = useState<Partial<Record<LeaderboardPeriod, readonly LeaderboardEntry[]>>>(
    {},
  );
  const entries = rows[period] ?? null;

  useEffect(() => {
    let active = true;
    void fetchLeaderboard(period).then((fetched) => {
      if (active) setRows((current) => ({ ...current, [period]: fetched }));
    });
    return () => {
      active = false;
    };
  }, [period]);

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-neutral-900 dark:text-white">
          <TrophyIcon className="h-4 w-4 text-amber-500" />
          {t('title')}
        </h2>

        <div
          role="tablist"
          aria-label={t('title')}
          className="flex rounded-full bg-neutral-100 p-0.5 dark:bg-neutral-800"
        >
          {PERIODS.map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={period === option}
              onClick={() => setPeriod(option)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                period === option
                  ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                  : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
              }`}
            >
              {t(`period.${option}`)}
            </button>
          ))}
        </div>
      </header>

      {entries === null ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <SpinnerIcon className="h-6 w-6 animate-spin text-brand" />
        </div>
      ) : (
        <ol className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
          {entries.map((entry) => (
            <li key={entry.username} className="flex items-center gap-3.5 px-5 py-3">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  PODIUM[entry.rank] ??
                  'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                }`}
              >
                {entry.rank}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {entry.username}
                </p>
                <p className="text-xs tabular-nums text-neutral-400 dark:text-neutral-500">
                  {t('minutes', { count: entry.minutes })}
                </p>
              </div>

              <span className="shrink-0 text-right text-sm font-medium tabular-nums text-neutral-500 dark:text-neutral-400">
                {t('calls', { count: entry.calls })}
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className="border-t border-neutral-200 px-5 py-3 text-xs text-neutral-400 dark:border-neutral-800 dark:text-neutral-500">
        {t('note')}
      </p>
    </section>
  );
}
