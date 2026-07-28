'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AuthShell } from '@/components/auth/AuthShell';
import { Field, FormError, FormSuccess, SubmitButton, TextInput } from '@/components/auth/fields';
import { forgotPassword } from '@/lib/auth';

export default function ForgotPasswordPage(): React.ReactElement {
  const t = useTranslations('account');
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    setPending(true);
    setError(null);

    void (async () => {
      try {
        await forgotPassword(email);
        setSent(true);
      } catch {
        // The server answers the same way for a registered and an unregistered
        // address, so anything reaching here is a transport or rate-limit
        // failure — never a signal about whether the account exists.
        setError(t('resetRequestFailed'));
      } finally {
        setPending(false);
      }
    })();
  };

  return (
    <AuthShell
      title={t('forgotTitle')}
      subtitle={t('forgotSubtitle')}
      footer={
        <Link href="/login" className="font-semibold text-brand hover:underline">
          {t('backToSignIn')}
        </Link>
      }
    >
      {sent ? (
        // Worded so it says nothing about whether the address is registered.
        <FormSuccess message={t('resetSent')} />
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <FormError message={error} />

          <Field id="email" label={t('email')}>
            <TextInput
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              disabled={pending}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>

          <SubmitButton pending={pending}>{t('sendResetLink')}</SubmitButton>
        </form>
      )}
    </AuthShell>
  );
}
