'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { SiteHeader } from '@/components/SiteHeader';
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
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          {t('forgotTitle')}
        </h1>
        <p className="pt-2 text-sm text-neutral-500 dark:text-neutral-400">{t('forgotSubtitle')}</p>

        {sent ? (
          // Worded so it says nothing about whether the address is registered.
          <div className="pt-8">
            <FormSuccess message={t('resetSent')} />
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 pt-8">
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

        <p className="pt-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
          <Link href="/login" className="font-semibold text-brand hover:underline">
            {t('backToSignIn')}
          </Link>
        </p>
      </main>
    </div>
  );
}
