'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AuthDivider, AuthShell } from '@/components/auth/AuthShell';
import { useAuth } from '@/components/auth/AuthProvider';
import { PasskeyButton } from '@/components/auth/PasskeyButton';
import { SocialButtons } from '@/components/auth/SocialButtons';
import { Field, FormError, SubmitButton, TextInput } from '@/components/auth/fields';
import { useOAuthProviders } from '@/hooks/useOAuthProviders';
import { useWebAuthnSupport } from '@/hooks/useWebAuthnSupport';
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

  const providers = useOAuthProviders();
  const passkeysSupported = useWebAuthnSupport();

  // The rule below the password form only earns its space if one of the
  // alternatives it introduces can actually be offered here.
  const hasAlternatives = providers.length > 0 || passkeysSupported;

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
    <AuthShell
      title={t('signInTitle')}
      subtitle={t('signInSubtitle')}
      footer={
        <>
          {t('noAccount')}{' '}
          <Link href="/signup" className="font-semibold text-brand hover:underline">
            {t('signUp')}
          </Link>
        </>
      }
    >
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
          <Link href="/forgot-password" className="text-xs font-medium text-brand hover:underline">
            {t('forgotPassword')}
          </Link>
        </div>

        <SubmitButton pending={pending}>{t('signIn')}</SubmitButton>
      </form>

      {hasAlternatives && <AuthDivider label={t('or')} />}

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
    </AuthShell>
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
