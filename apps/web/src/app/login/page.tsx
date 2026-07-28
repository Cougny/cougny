'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SiteHeader } from '@/components/SiteHeader';
import { useAuth } from '@/components/auth/AuthProvider';
import { PasskeyButton } from '@/components/auth/PasskeyButton';
import { SocialButtons } from '@/components/auth/SocialButtons';
import { Field, FormError, SubmitButton, TextInput } from '@/components/auth/fields';
import { AuthError } from '@/lib/auth';

/** Errors the OAuth callback can redirect back with, mapped to message keys. */
const OAUTH_ERROR_KEYS: Record<string, string> = {
  cancelled: 'socialCancelled',
  invalid_state: 'socialError',
  provider_error: 'socialError',
  account_unavailable: 'accountUnavailable',
};

function LoginForm(): React.ReactElement {
  const t = useTranslations('account');
  const router = useRouter();
  const params = useSearchParams();
  const { signIn, adopt } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);

  const callbackError = params.get('error');
  const [error, setError] = useState<string | null>(
    callbackError ? t(OAUTH_ERROR_KEYS[callbackError] ?? 'socialError') : null,
  );

  /** After signing in, a social sign-up may still owe us its profile details. */
  const onSignedIn = (profileComplete: boolean): void => {
    router.push(profileComplete ? '/' : '/signup/complete');
  };

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    setPending(true);
    setError(null);

    void (async () => {
      try {
        const user = await signIn(email, password);
        onSignedIn(user.profileComplete);
      } catch (err) {
        setError(
          err instanceof AuthError && err.code === 'account_banned'
            ? t('accountUnavailable')
            : t('invalidCredentials'),
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
          {t('signInTitle')}
        </h1>
        <p className="pt-2 text-sm text-neutral-500 dark:text-neutral-400">{t('signInSubtitle')}</p>

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

          <Field id="password" label={t('password')}>
            <TextInput
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              disabled={pending}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>

          <div className="text-right">
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-brand hover:underline"
            >
              {t('forgotPassword')}
            </Link>
          </div>

          <SubmitButton pending={pending}>{t('signIn')}</SubmitButton>
        </form>

        <div className="flex items-center gap-3 py-6">
          <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
          <span className="text-xs uppercase tracking-wider text-neutral-400">{t('or')}</span>
          <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
        </div>

        <div className="space-y-2">
          <PasskeyButton
            email={email || undefined}
            onSuccess={(response) => {
              adopt(response);
              onSignedIn(response.user.profileComplete);
            }}
            onError={setError}
          />
          <SocialButtons mode="login" onError={setError} />
        </div>

        <p className="pt-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
          {t('noAccount')}{' '}
          <Link href="/signup" className="font-semibold text-brand hover:underline">
            {t('signUp')}
          </Link>
        </p>
      </main>
    </div>
  );
}

export default function LoginPage(): React.ReactElement {
  // `useSearchParams` needs a Suspense boundary to keep the rest of the route
  // statically renderable.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
