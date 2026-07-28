'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { AuthStatus } from '@/components/auth/AuthProvider';
import { AuthBackdrop } from '@/components/auth/AuthBackdrop';
import { AuthShell } from '@/components/auth/AuthShell';
import { SpinnerIcon } from '@/components/icons';

interface SignInGateProps {
  status: AuthStatus;
  /** False for a social sign-up that has not finished the completion step. */
  profileComplete: boolean;
}

/**
 * What a visitor sees in place of the call stage when they cannot call yet.
 *
 * The same floating card as the account screens, over the same blurred view of
 * the app: the product is visible but out of reach, and the one way through it
 * is the card. Moving on to sign-up or sign-in swaps the card's contents and
 * leaves the backdrop where it is.
 *
 * This replaces the old consent splash. The age, conduct, and terms
 * attestations now live in the sign-up form, where they are recorded against a
 * real account rather than a checkbox in this browser's local storage — which
 * anyone could clear, and which said nothing about who agreed.
 */
export function SignInGate({ status, profileComplete }: SignInGateProps): React.ReactElement {
  const t = useTranslations('call');
  const tApp = useTranslations('app');
  const tAccount = useTranslations('account');

  // Says nothing until the initial refresh resolves: flashing "sign in" at
  // someone who is already signed in reads as being logged out.
  if (status === 'loading') {
    return (
      <div className="relative flex min-h-dvh items-center justify-center">
        <AuthBackdrop />
        <SpinnerIcon className="relative h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  const needsCompletion = status === 'authenticated' && !profileComplete;

  return (
    <AuthShell
      title={tApp('tagline')}
      subtitle={needsCompletion ? tAccount('completeSubtitle') : t('signInToStart')}
    >
      <div className="flex flex-col gap-3">
        {needsCompletion ? (
          <Link
            href="/signup/complete"
            className="rounded-xl bg-neutral-900 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-neutral-800 active:scale-[0.99] dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {tAccount('finishSetup')}
          </Link>
        ) : (
          <>
            <Link
              href="/signup"
              className="rounded-xl bg-neutral-900 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-neutral-800 active:scale-[0.99] dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              {tAccount('createAccount')}
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-neutral-200 px-4 py-2.5 text-center text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 active:scale-[0.99] dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              {tAccount('signIn')}
            </Link>
          </>
        )}
      </div>

      <p className="pt-6 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        {t('adultsOnlyNotice')}
      </p>
    </AuthShell>
  );
}
