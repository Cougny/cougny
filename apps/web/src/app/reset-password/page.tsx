'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AuthShell } from '@/components/auth/AuthShell';
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
    <AuthShell
      title={t('resetTitle')}
      footer={
        <Link href="/login" className="font-semibold text-brand hover:underline">
          {t('backToSignIn')}
        </Link>
      }
    >
      {!token ? (
        <FormError message={t('resetLinkInvalid')} />
      ) : done ? (
        <FormSuccess message={t('resetDone')} />
      ) : (
        <form onSubmit={submit} className="space-y-4">
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
    </AuthShell>
  );
}

export default function ResetPasswordPage(): React.ReactElement {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
