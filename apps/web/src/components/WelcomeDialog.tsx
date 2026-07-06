'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

const STORAGE_KEY = 'cougny.welcomeAccepted.v4';

export function useWelcomeAccepted(): [boolean, (accepted: boolean) => void] {
  // Always start false so SSR and the first client render match.
  // Sync with localStorage after mount to skip the dialog for returning users.
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === 'true') {
        setAccepted(true);
      }
    } catch {
      // localStorage unavailable — ignore.
    }
  }, []);

  const persist = (value: boolean): void => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // localStorage unavailable — ignore.
    }
    setAccepted(value);
  };

  return [accepted, persist];
}

interface Props {
  onAccept: () => void;
}

export function WelcomeDialog({ onAccept }: Props): React.ReactElement {
  const t = useTranslations('welcome');
  const [age, setAge] = useState(false);
  const [csam, setCsam] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState(false);
  const all = age && csam && terms;

  const accept = (): void => {
    if (!all) {
      setError(true);
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, 'true');
    } catch {}
    onAccept();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 p-4 backdrop-blur-xl dark:bg-black/80">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-neutral-200/60 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
        {/* Header */}
        <div className="shrink-0 border-b border-neutral-100 px-8 pb-6 pt-10 text-center dark:border-neutral-800">
          <h1 className="font-display text-3xl tracking-wide text-neutral-900 dark:text-white">
            COUGNY
          </h1>
          <p className="mt-4 text-sm font-bold uppercase tracking-[0.3em] text-neutral-400 dark:text-neutral-500">
            Terms &amp; Conditions
          </p>
        </div>

        {/* Scrollable agreements */}
        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-6">
          {/* Age */}
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
              age
                ? 'border-neutral-300 bg-neutral-50 shadow-sm dark:border-neutral-700 dark:bg-neutral-900'
                : 'border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-800 dark:bg-transparent dark:hover:border-neutral-700'
            }`}
          >
            <input
              type="checkbox"
              checked={age}
              onChange={(e) => {
                setAge(e.target.checked);
                setError(false);
              }}
              className="mt-0.5 h-5 w-5 shrink-0 rounded accent-brand"
            />
            <div>
              <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                {t('ageCheck')}
              </span>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                {t('ageText')}
              </p>
            </div>
          </label>

          {/* CSAM */}
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
              csam
                ? 'border-neutral-300 bg-neutral-50 shadow-sm dark:border-neutral-700 dark:bg-neutral-900'
                : 'border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-800 dark:bg-transparent dark:hover:border-neutral-700'
            }`}
          >
            <input
              type="checkbox"
              checked={csam}
              onChange={(e) => {
                setCsam(e.target.checked);
                setError(false);
              }}
              className="mt-0.5 h-5 w-5 shrink-0 rounded accent-brand"
            />
            <div>
              <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                {t('csamCheck')}
              </span>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                {t('csamText')}
              </p>
            </div>
          </label>

          {/* Terms */}
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
              terms
                ? 'border-neutral-300 bg-neutral-50 shadow-sm dark:border-neutral-700 dark:bg-neutral-900'
                : 'border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-800 dark:bg-transparent dark:hover:border-neutral-700'
            }`}
          >
            <input
              type="checkbox"
              checked={terms}
              onChange={(e) => {
                setTerms(e.target.checked);
                setError(false);
              }}
              className="mt-0.5 h-5 w-5 shrink-0 rounded accent-brand"
            />
            <div>
              <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                {t('termsCheck')}
              </span>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                {t('termsText')}
              </p>
            </div>
          </label>
        </div>

        {/* Button */}
        <div className="shrink-0 border-t border-neutral-100 px-6 py-5 dark:border-neutral-800">
          {error && (
            <p className="mb-3 text-center text-sm font-semibold text-red-500">
              {t('allRequired')}
            </p>
          )}
          <button
            onClick={accept}
            disabled={!all}
            className={`w-full rounded-2xl py-3.5 text-sm font-bold uppercase tracking-widest transition-all ${
              all
                ? 'bg-brand text-white shadow-md hover:bg-brand-strong hover:shadow-lg active:scale-[0.99] dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200'
                : 'cursor-not-allowed bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-600'
            }`}
          >
            {t('agreeButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
