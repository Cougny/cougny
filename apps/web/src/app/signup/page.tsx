'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { isAtLeastMinimumAge, type CountryCode } from '@cougny/protocol';
import { AuthDivider, AuthShell } from '@/components/auth/AuthShell';
import { useAuth } from '@/components/auth/AuthProvider';
import { CountrySelect } from '@/components/auth/CountrySelect';
import { DateOfBirthField } from '@/components/auth/DateOfBirthField';
import { SocialButtons } from '@/components/auth/SocialButtons';
import { Field, FormError, SubmitButton, TextInput } from '@/components/auth/fields';
import { useOAuthProviders } from '@/hooks/useOAuthProviders';
import { AuthError } from '@/lib/auth';

/** Server error codes that name a specific field, mapped to message keys. */
const ERROR_KEYS: Record<string, string> = {
  email_taken: 'emailTaken',
  username_taken: 'usernameTaken',
  age_requirement: 'ageRequirement',
};

export default function SignUpPage(): React.ReactElement {
  const t = useTranslations('account');
  const router = useRouter();
  const { signUp } = useAuth();
  // Nothing to separate when no provider is configured, so no rule either.
  const hasProviders = useOAuthProviders().length > 0;

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [country, setCountry] = useState<CountryCode | ''>('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedConduct, setAcceptedConduct] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The same predicate the server applies, so the button's enabled state and
  // the server's verdict cannot disagree.
  const oldEnough = dateOfBirth !== '' && isAtLeastMinimumAge(dateOfBirth);
  const complete =
    email !== '' && username !== '' && password !== '' && country !== '' && oldEnough;

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!acceptedTerms) {
      setError(t('mustAcceptTerms'));
      return;
    }
    if (!acceptedConduct) {
      setError(t('mustAcceptConduct'));
      return;
    }
    if (!oldEnough) {
      setError(t('ageRequirement'));
      return;
    }
    // Also narrows `country` from `CountryCode | ''` to a real code.
    if (country === '') return;

    setPending(true);
    setError(null);

    void (async () => {
      try {
        await signUp({ email, username, password, dateOfBirth, country });
        router.push('/dashboard');
      } catch (err) {
        setError(
          err instanceof AuthError ? t(ERROR_KEYS[err.code] ?? 'signUpFailed') : t('signUpFailed'),
        );
        setPending(false);
      }
    })();
  };

  return (
    <AuthShell
      title={t('signUpTitle')}
      subtitle={t('signUpSubtitle')}
      footer={
        <>
          {t('haveAccount')}{' '}
          <Link href="/login" className="font-semibold text-brand hover:underline">
            {t('signIn')}
          </Link>
        </>
      }
    >
      <SocialButtons mode="login" onError={setError} />

      {hasProviders && <AuthDivider label={t('or')} />}

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

        <Field id="username" label={t('username')} hint={t('usernameHint')}>
          <TextInput
            id="username"
            name="username"
            autoComplete="username"
            required
            minLength={3}
            maxLength={20}
            pattern="[A-Za-z0-9_]+"
            value={username}
            disabled={pending}
            onChange={(event) => setUsername(event.target.value)}
          />
        </Field>

        <Field id="password" label={t('password')} hint={t('passwordHint')}>
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

        <Field id="dateOfBirth" label={t('dateOfBirth')} hint={t('ageRequirementHint')}>
          <DateOfBirthField
            id="dateOfBirth"
            value={dateOfBirth}
            disabled={pending}
            onChange={setDateOfBirth}
          />
        </Field>

        <Field id="country" label={t('country')}>
          <CountrySelect
            id="country"
            value={country}
            required
            disabled={pending}
            onChange={setCountry}
          />
        </Field>

        <label className="flex cursor-pointer items-start gap-3 pt-2">
          <input
            type="checkbox"
            checked={acceptedTerms}
            disabled={pending}
            onChange={(event) => {
              setAcceptedTerms(event.target.checked);
              setError(null);
            }}
            className="mt-0.5 h-4 w-4 shrink-0 rounded accent-brand"
          />
          <span className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
            {t.rich('acceptTerms', {
              terms: (chunks) => (
                <Link href="/terms" className="font-medium text-brand hover:underline">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={acceptedConduct}
            disabled={pending}
            onChange={(event) => {
              setAcceptedConduct(event.target.checked);
              setError(null);
            }}
            className="mt-0.5 h-4 w-4 shrink-0 rounded accent-brand"
          />
          <span className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
            {t('acceptConduct')}
          </span>
        </label>

        <SubmitButton pending={pending} disabled={!complete || !acceptedTerms || !acceptedConduct}>
          {t('createAccount')}
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
