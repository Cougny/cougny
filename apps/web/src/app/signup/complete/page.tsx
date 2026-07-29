'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { isAtLeastMinimumAge, type CountryCode } from '@cougny/protocol';
import { AuthBackdrop } from '@/components/auth/AuthBackdrop';
import { AuthShell } from '@/components/auth/AuthShell';
import { useAuth } from '@/components/auth/AuthProvider';
import { CountrySelect } from '@/components/auth/CountrySelect';
import { DateOfBirthField } from '@/components/auth/DateOfBirthField';
import { Field, FormError, SubmitButton, TextInput } from '@/components/auth/fields';
import { AuthError, completeProfile } from '@/lib/auth';

/**
 * The second half of a social sign-up.
 *
 * Google and Discord can vouch for an identity but not for an age, a country,
 * or an acceptance of the terms — so an account created that way arrives
 * incomplete and lands here. Until this form is submitted the account exists
 * but is not usable, which is what keeps the 18+ requirement from being
 * side-stepped by choosing the social path.
 */
export default function CompleteProfilePage(): React.ReactElement {
  const t = useTranslations('account');
  const router = useRouter();
  const { status, user, token, setUser } = useAuth();

  // `null` means untouched, so the suggested handle can show until the user
  // types. Kept as a derived display value rather than seeded through an
  // effect, which would fight their edits and cost an extra render.
  const [typedUsername, setTypedUsername] = useState<string | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [country, setCountry] = useState<CountryCode | ''>('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedConduct, setAcceptedConduct] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
    // Nothing left to complete: send them on rather than showing a dead form.
    else if (status === 'authenticated' && user?.profileComplete) router.replace('/dashboard');
  }, [status, user, router]);

  // Mid-redirect: the backdrop alone, so the hand-off is not a white flash.
  if (status !== 'authenticated' || !token || !user || user.profileComplete) {
    return <AuthBackdrop />;
  }

  /*
   * The provider's display name, cleaned to the characters a handle allows,
   * offered until the user types something of their own.
   */
  const suggestedUsername = (user.displayName ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20);
  const username = typedUsername ?? suggestedUsername;

  const oldEnough = dateOfBirth !== '' && isAtLeastMinimumAge(dateOfBirth);
  const complete =
    username !== '' && country !== '' && oldEnough && acceptedTerms && acceptedConduct;

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    // `complete` includes `country !== ''`, which also narrows it to a real code.
    if (!complete) return;

    setPending(true);
    setError(null);

    void (async () => {
      try {
        setUser(
          await completeProfile(token, {
            username,
            dateOfBirth,
            country,
            acceptedTerms: true,
            acceptedConduct: true,
          }),
        );
        router.push('/dashboard');
      } catch (err) {
        setError(
          err instanceof AuthError && err.code === 'username_taken'
            ? t('usernameTaken')
            : err instanceof AuthError && err.code === 'age_requirement'
              ? t('ageRequirement')
              : t('signUpFailed'),
        );
        setPending(false);
      }
    })();
  };

  return (
    <AuthShell title={t('completeTitle')} subtitle={t('completeSubtitle')}>
      <form onSubmit={submit} className="space-y-4">
        <FormError message={error} />

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
            onChange={(event) => setTypedUsername(event.target.value)}
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
            onChange={(event) => setAcceptedTerms(event.target.checked)}
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

        <SubmitButton pending={pending} disabled={!complete}>
          {t('finishSetup')}
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
