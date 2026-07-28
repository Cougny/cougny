'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SiteHeader } from '@/components/SiteHeader';
import { Field, FormError, FormSuccess, SubmitButton, TextInput } from '@/components/auth/fields';
import { AuthError, resetPassword } from '@/lib/auth';

function ResetForm(): React.ReactElement {
  const t = useTranslations('account');
  const router = useRouter();
  const token = useSearchParams().get('token');

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatched = confirmation !== '' && password !== confirmation;

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!token || mismatched) return;

    setPending(true);
    setError(null);

    void (async () => {
      try {
        await resetPassword(token, password);
        setDone(true);
        // The reset revoked every session, so there is nothing to be signed in
        // to — send them to sign in with the new password.
        setTimeout(() => router.push('/login'), 2000);
      } catch (err) {
        setError(
          err instanceof AuthError && err.code === 'invalid_token'
            ? t('resetLinkInvalid')
            : t('resetFailed'),
        );
        setPending(false);
      }
    })();
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          {t('resetTitle')}
        </h1>

        {!token ? (
          <div className="pt-8">
            <FormError message={t('resetLinkInvalid')} />
          </div>
        ) : done ? (
          <div className="pt-8">
            <FormSuccess message={t('resetDone')} />
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 pt-8">
            <FormError message={error} />

            <Field id="password" label={t('newPassword')} hint={t('passwordHint')}>
              <TextInput
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                value={password}
                disabled={pending}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>

            <Field id="confirmation" label={t('confirmPassword')}>
              <TextInput
                id="confirmation"
                name="confirmation"
                type="password"
                autoComplete="new-password"
                required
                value={confirmation}
                disabled={pending}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </Field>

            {mismatched && <FormError message={t('passwordsDoNotMatch')} />}

            <SubmitButton pending={pending} disabled={mismatched || password === ''}>
              {t('setNewPassword')}
            </SubmitButton>
          </form>
        )}

        <p className="pt-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
          <Link href="/login" className="font-semibold text-brand hover:underline">
            {t('backToSignIn')}
          </Link>
        </p>
      </main>
    </div>
  );
}

export default function ResetPasswordPage(): React.ReactElement {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
