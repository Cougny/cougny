'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { AuthStatus } from '@/components/auth/AuthProvider';
import { SpinnerIcon, UserIcon } from '@/components/icons';

interface SignInGateProps {
  status: AuthStatus;
  /** False for a social sign-up that has not finished the completion step. */
  profileComplete: boolean;
}

/**
 * What a visitor sees in place of the call stage when they cannot call yet.
 *
 * This replaces the old consent splash. The age, conduct, and terms
 * attestations now live in the sign-up form, where they are recorded against a
 * real account rather than a checkbox in this browser's local storage — which
 * anyone could clear, and which said nothing about who agreed.
 */
export function SignInGate({ status, profileComplete }: SignInGateProps): React.ReactElement {
  const t = useTranslations('call');
  const tAccount = useTranslations('account');

  // Says nothing until the initial refresh resolves: flashing "sign in" at
  // someone who is already signed in reads as being logged out.
  if (status === 'loading') {
    return (
      <main className="flex flex-1 items-center justify-center">
        <SpinnerIcon className="h-8 w-8 animate-spin text-brand" />
      </main>
    );
  }

  const needsCompletion = status === 'authenticated' && !profileComplete;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
        <UserIcon className="h-8 w-8" />
      </span>

      <h1 className="pt-6 font-display text-4xl tracking-wide text-neutral-900 dark:text-white">
        COUGNY
      </h1>
      <p className="max-w-md pt-3 text-base text-neutral-600 dark:text-neutral-300">
        {needsCompletion ? tAccount('completeSubtitle') : t('signInToStart')}
      </p>

      <div className="flex w-full max-w-xs flex-col gap-3 pt-8">
        {needsCompletion ? (
          <Link
            href="/signup/complete"
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-fg transition hover:bg-brand-strong active:scale-[0.99]"
          >
            {tAccount('finishSetup')}
          </Link>
        ) : (
          <>
            <Link
              href="/signup"
              className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-fg transition hover:bg-brand-strong active:scale-[0.99]"
            >
              {tAccount('createAccount')}
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 active:scale-[0.99] dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              {tAccount('signIn')}
            </Link>
          </>
        )}
      </div>

      <p className="max-w-sm pt-8 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        {t('adultsOnlyNotice')}
      </p>
    </main>
  );
}
