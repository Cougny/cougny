'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

const STORAGE_KEY = 'cougny.welcomeAccepted.v2';

export function useWelcomeAccepted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 p-4 backdrop-blur-xl">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-neutral-900">
        {/* Premium gradient header */}
        <div className="shrink-0 bg-gradient-to-br from-emerald-600 via-emerald-500 to-green-500 px-8 pb-8 pt-10 text-center text-white">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="h-7 w-7"
            >
              <path d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-2 text-base font-medium italic text-white/80">
            &ldquo;{t('slogan')}&rdquo;
          </p>
          <p className="mt-3 text-sm leading-relaxed text-white/70">{t('intro')}</p>
        </div>

        {/* Scrollable agreements */}
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
          {/* Age */}
          <div
            className={`rounded-2xl border-2 p-4 transition ${age ? 'border-emerald-400 bg-emerald-50/50 dark:border-emerald-600 dark:bg-emerald-950/20' : 'border-neutral-200 dark:border-neutral-700'}`}
          >
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={age}
                onChange={(e) => {
                  setAge(e.target.checked);
                  setError(false);
                }}
                className="mt-0.5 h-5 w-5 shrink-0 rounded accent-emerald-500"
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
          </div>

          {/* CSAM */}
          <div
            className={`rounded-2xl border-2 p-4 transition ${csam ? 'border-red-400 bg-red-50/50 dark:border-red-600 dark:bg-red-950/20' : 'border-neutral-200 dark:border-neutral-700'}`}
          >
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={csam}
                onChange={(e) => {
                  setCsam(e.target.checked);
                  setError(false);
                }}
                className="mt-0.5 h-5 w-5 shrink-0 rounded accent-red-500"
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
          </div>

          {/* Terms */}
          <div
            className={`rounded-2xl border-2 p-4 transition ${terms ? 'border-brand bg-brand/5 dark:border-brand dark:bg-brand/10' : 'border-neutral-200 dark:border-neutral-700'}`}
          >
            <label className="flex cursor-pointer items-start gap-3">
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
                ? 'bg-gradient-to-br from-emerald-600 to-green-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 active:scale-[0.99]'
                : 'cursor-not-allowed bg-neutral-200 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-600'
            }`}
          >
            {t('agreeButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
