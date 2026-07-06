'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import type { GenderPreference, MatchPreferences } from '@cougny/protocol';
import type { CallStatus } from '@/hooks/useRandomCall';
import { NextIcon, StopIcon } from '@/components/icons';

const PREFS_STORAGE_KEY = 'cougny.matchPreferences';
const PREFS_CHANGE_EVENT = 'cougny:prefs-change';

interface StoredPrefs {
  gender: GenderPreference;
}

const DEFAULT_PREFS: StoredPrefs = { gender: 'any' };

function subscribeToPrefs(onChange: () => void): () => void {
  window.addEventListener(PREFS_CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(PREFS_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

function parsePrefs(raw: string): StoredPrefs {
  try {
    const parsed = JSON.parse(raw) as Partial<StoredPrefs>;
    return {
      gender:
        parsed.gender === 'male' || parsed.gender === 'female'
          ? parsed.gender
          : DEFAULT_PREFS.gender,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

interface MatchControlsProps {
  status: CallStatus;
  onStart: () => void;
  onSkip: () => void;
  onStop: () => void;
  onPreferencesChange: (preferences: MatchPreferences) => void;
}

/** Three equal control blocks: start/stop, skip, gender filter. */
export function MatchControls({
  status,
  onStart,
  onSkip,
  onStop,
  onPreferencesChange,
}: MatchControlsProps): React.ReactElement {
  const t = useTranslations('call');

  const rawPrefs = useSyncExternalStore(
    subscribeToPrefs,
    () => window.localStorage.getItem(PREFS_STORAGE_KEY) ?? '{}',
    () => '{}',
  );
  const prefs = useMemo(() => parsePrefs(rawPrefs), [rawPrefs]);

  // Keep the call hook's queue.join payload in sync with the stored filters.
  useEffect(() => {
    onPreferencesChange({
      gender: prefs.gender === 'any' ? undefined : prefs.gender,
    });
  }, [prefs, onPreferencesChange]);

  const setPrefs = (patch: Partial<StoredPrefs>): void => {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ ...prefs, ...patch }));
    window.dispatchEvent(new Event(PREFS_CHANGE_EVENT));
  };

  const idle = status === 'idle' || status === 'error';

  return (
    <div className="flex h-full items-center justify-center p-2 sm:p-3.5">
      <div className="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-4">
        {idle ? (
          <button
            onClick={onStart}
            className="aspect-[3/2] flex flex-col items-center justify-center gap-1 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-emerald-500/20 transition hover:scale-[1.02] hover:shadow-lg hover:shadow-emerald-500/25 active:scale-[0.98] sm:text-sm"
          >
            {t('start')}
          </button>
        ) : (
          <button
            onClick={onStop}
            className="aspect-[3/2] flex flex-col items-center justify-center gap-1 rounded-2xl bg-red-500 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-red-500/20 transition hover:scale-[1.02] hover:bg-red-400 hover:shadow-lg hover:shadow-red-500/25 active:scale-[0.98] sm:text-sm"
          >
            <StopIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            {t('stop')}
          </button>
        )}

        <button
          onClick={onSkip}
          disabled={idle}
          className="aspect-[3/2] flex flex-col items-center justify-center gap-1 rounded-2xl border border-violet-200 bg-violet-50 text-xs font-bold uppercase tracking-wider text-violet-600 shadow-sm transition hover:scale-[1.02] hover:border-violet-300 hover:bg-violet-100 hover:text-violet-700 active:scale-[0.98] disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300 dark:hover:bg-violet-950 sm:text-sm"
        >
          <NextIcon className="h-4 w-4 sm:h-5 sm:w-5" />
          {t('skip')}
        </button>

        <button
          disabled
          className="aspect-[3/2] flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/70 text-xs font-bold uppercase tracking-wider text-neutral-400 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-600 sm:text-sm"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            {t('countryLabel')}
          </span>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-600">
            {t('comingSoon')}
          </span>
        </button>

        <button
          onClick={() => {
            const options: GenderPreference[] = ['any', 'male', 'female'];
            const idx = options.indexOf(prefs.gender as GenderPreference);
            const next = options[(idx + 1) % options.length];
            setPrefs({ gender: next });
          }}
          className={`flex h-full w-full flex-col items-center justify-center gap-1 rounded-2xl border px-1 transition hover:scale-[1.02] active:scale-[0.98] ${
            prefs.gender === 'male'
              ? 'border-blue-400 bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/25 dark:border-blue-600 dark:from-blue-600 dark:to-indigo-700'
              : prefs.gender === 'female'
                ? 'border-pink-400 bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-md shadow-pink-500/20 hover:shadow-lg hover:shadow-pink-500/25 dark:border-pink-600 dark:from-pink-600 dark:to-rose-700'
                : 'border-neutral-200 bg-neutral-50 text-neutral-600 shadow-sm hover:border-neutral-300 hover:bg-neutral-100 hover:text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900/70 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:bg-neutral-900'
          }`}
        >
          <span
            className={`text-[10px] font-bold uppercase tracking-wider ${
              prefs.gender === 'male' || prefs.gender === 'female'
                ? 'text-white/70'
                : 'text-neutral-400 dark:text-neutral-500'
            }`}
          >
            {t('genderLabel')}
          </span>
          <span
            className={`text-sm font-semibold ${
              prefs.gender === 'male' || prefs.gender === 'female'
                ? 'text-white'
                : 'text-neutral-800 dark:text-neutral-200'
            }`}
          >
            {prefs.gender === 'male'
              ? t('genderMale')
              : prefs.gender === 'female'
                ? t('genderFemale')
                : t('anyOption')}
          </span>
        </button>
      </div>
    </div>
  );
}
