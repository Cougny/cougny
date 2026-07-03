'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
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

  const [openPicker, setOpenPicker] = useState<'gender' | null>(null);

  const idle = status === 'idle' || status === 'error';

  return (
    <div className="flex h-full items-center justify-center p-1.5 sm:p-3">
      <div className="grid w-full grid-cols-4 gap-1.5 sm:gap-3">
        {idle ? (
          <button
            onClick={onStart}
            className="aspect-square flex flex-col items-center justify-center gap-1 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-emerald-500/25 transition hover:scale-[1.02] hover:opacity-90 active:scale-[0.98] sm:text-sm"
          >
            {t('start')}
          </button>
        ) : (
          <button
            onClick={onStop}
            className="aspect-square flex flex-col items-center justify-center gap-1 rounded-xl bg-red-600 text-xs font-bold uppercase tracking-wider text-white transition hover:scale-[1.02] hover:bg-red-500 active:scale-[0.98] sm:text-sm"
          >
            <StopIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            {t('stop')}
          </button>
        )}

        <button
          onClick={onSkip}
          disabled={idle}
          className="aspect-square flex flex-col items-center justify-center gap-1 rounded-xl border border-brand/30 bg-brand/10 text-xs font-bold uppercase tracking-wider text-brand transition hover:scale-[1.02] hover:bg-brand/20 active:scale-[0.98] disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-brand/50 dark:bg-brand/20 dark:text-violet-200 dark:hover:bg-brand/30 sm:text-sm"
        >
          <NextIcon className="h-4 w-4 sm:h-5 sm:w-5" />
          {t('skip')}
        </button>

        <PickerBlock
          label={t('genderLabel')}
          value={prefs.gender}
          open={openPicker === 'gender'}
          onToggle={() => setOpenPicker(openPicker === 'gender' ? null : 'gender')}
          onSelect={(gender) => {
            setPrefs({ gender: gender as GenderPreference });
            setOpenPicker(null);
          }}
          options={[
            { value: 'any', label: t('anyOption') },
            { value: 'male', label: t('genderMale') },
            { value: 'female', label: t('genderFemale') },
          ]}
        />

        <button
          disabled
          className="aspect-square flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-neutral-300 bg-neutral-100 text-xs font-bold uppercase tracking-wider text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-600 sm:text-sm"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            {t('countryLabel')}
          </span>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-600">
            {t('comingSoon')}
          </span>
        </button>
      </div>
    </div>
  );
}

interface PickerOption {
  value: string;
  label: string;
}

function PickerBlock({
  label,
  value,
  options,
  open,
  onToggle,
  onSelect,
}: {
  label: string;
  value: string;
  options: PickerOption[];
  open: boolean;
  onToggle: () => void;
  onSelect: (value: string) => void;
}): React.ReactElement {
  const selected = options.find((option) => option.value === value) ?? options[0];

  // Close with Escape while the popup is open.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onToggle();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onToggle]);

  return (
    <div className="relative aspect-square min-w-0">
      <button
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex h-full w-full flex-col items-center justify-center gap-1 rounded-xl border bg-white px-1 transition hover:border-neutral-300 dark:bg-neutral-900 dark:hover:border-neutral-600 ${
          open ? 'border-brand dark:border-brand' : 'border-neutral-200 dark:border-neutral-800'
        }`}
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          {label}
        </span>
        <span className="flex max-w-full items-center gap-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          <span className="truncate">{selected?.label}</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={`h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform dark:text-neutral-500 ${open ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {open && (
        <>
          {/* Click-away backdrop. */}
          <div className="fixed inset-0 z-40" onClick={onToggle} />

          <ul
            role="listbox"
            aria-label={label}
            className="absolute bottom-full left-1/2 z-50 mb-2 max-h-72 w-56 -translate-x-1/2 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <li key={option.value}>
                  <button
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => onSelect(option.value)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      isSelected
                        ? 'bg-brand/10 font-semibold text-brand dark:bg-brand/20 dark:text-violet-200'
                        : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                        className="h-4 w-4 shrink-0 text-brand"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
