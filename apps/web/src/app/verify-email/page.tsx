'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SiteHeader } from '@/components/SiteHeader';
import { FormError, FormSuccess } from '@/components/auth/fields';
import { SpinnerIcon } from '@/components/icons';
import { verifyEmail } from '@/lib/auth';

function VerifyEmail(): React.ReactElement {
  const t = useTranslations('account');
  const token = useSearchParams().get('token');
  // A link with no token has already failed; that is the initial state rather
  // than something an effect discovers and then sets.
  const [state, setState] = useState<'pending' | 'verified' | 'failed'>(
    token ? 'pending' : 'failed',
  );
  // The token is single-use, so a double-invoke in development must not spend
  // it twice and turn a success into a failure.
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    void verifyEmail(token)
      .then(() => setState('verified'))
      .catch(() => setState('failed'));
  }, [token]);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          {t('verifyEmailTitle')}
        </h1>

        <div className="pt-8">
          {state === 'pending' && (
            <div className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
              <SpinnerIcon className="h-5 w-5 animate-spin text-brand" />
              {t('verifying')}
            </div>
          )}
          {state === 'verified' && <FormSuccess message={t('emailVerified')} />}
          {state === 'failed' && <FormError message={t('verifyLinkInvalid')} />}
        </div>

        <p className="pt-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
          <Link href="/account" className="font-semibold text-brand hover:underline">
            {t('goToAccount')}
          </Link>
        </p>
      </main>
    </div>
  );
}

export default function VerifyEmailPage(): React.ReactElement {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
