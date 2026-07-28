'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { isCountryCode, type CountryCode, type UserProfile } from '@cougny/protocol';
import { CountrySelect } from '@/components/auth/CountrySelect';
import { Field, FormError, FormSuccess, TextInput } from '@/components/auth/fields';
import { Section, SecondaryButton } from '@/components/account/Section';
import { useAuth } from '@/components/auth/AuthProvider';
import { resendVerificationEmail, updateProfile } from '@/lib/auth';

interface Props {
  user: UserProfile;
  token: string;
}

/** Display name and country — the profile fields a user may change freely. */
export function ProfileSection({ user, token }: Props): React.ReactElement {
  const t = useTranslations('account');
  const locale = useLocale();
  const { setUser } = useAuth();

  const [displayName, setDisplayName] = useState(user.displayName ?? '');
  // The stored code is narrowed rather than asserted: a value the current list
  // no longer recognizes shows as unselected instead of breaking the control.
  const [country, setCountry] = useState<CountryCode | ''>(
    user.country && isCountryCode(user.country) ? user.country : '',
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const dirty = displayName !== (user.displayName ?? '') || country !== (user.country ?? '');

  const save = (event: React.FormEvent): void => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    void (async () => {
      try {
        setUser(
          await updateProfile(token, {
            displayName: displayName.trim() === '' ? null : displayName.trim(),
            ...(country ? { country } : {}),
          }),
        );
        setSaved(true);
      } catch {
        setError(t('saveFailed'));
      } finally {
        setPending(false);
      }
    })();
  };

  const resend = (): void => {
    void resendVerificationEmail(token)
      .then(() => setVerificationSent(true))
      .catch(() => setError(t('saveFailed')));
  };

  return (
    <Section title={t('profileTitle')} description={t('profileDescription')}>
      <form onSubmit={save} className="space-y-4">
        <FormError message={error} />
        {saved && <FormSuccess message={t('saved')} />}

        {/* Read-only identity. Changing a username or an age attestation is a
            support action, not a form field, so both are shown rather than edited. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
              {t('username')}
            </p>
            <p className="pt-1 text-sm text-neutral-900 dark:text-neutral-100">
              {user.username ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
              {t('dateOfBirth')}
            </p>
            <p className="pt-1 text-sm text-neutral-900 dark:text-neutral-100">
              {user.dateOfBirth
                ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
                    new Date(`${user.dateOfBirth}T00:00:00Z`),
                  )
                : '—'}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            {t('email')}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-sm text-neutral-900 dark:text-neutral-100">
              {user.email ?? '—'}
            </span>
            {user.email &&
              (user.emailVerified ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  {t('verified')}
                </span>
              ) : (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  {t('unverified')}
                </span>
              ))}
          </div>
          {user.email && !user.emailVerified && (
            <div className="pt-3">
              {verificationSent ? (
                <FormSuccess message={t('verificationSent')} />
              ) : (
                <SecondaryButton onClick={resend}>{t('resendVerification')}</SecondaryButton>
              )}
            </div>
          )}
        </div>

        <Field id="displayName" label={t('displayName')} hint={t('displayNameHint')}>
          <TextInput
            id="displayName"
            name="displayName"
            maxLength={40}
            value={displayName}
            disabled={pending}
            onChange={(event) => {
              setDisplayName(event.target.value);
              setSaved(false);
            }}
          />
        </Field>

        <Field id="country" label={t('country')}>
          <CountrySelect
            id="country"
            value={country}
            disabled={pending}
            onChange={(code) => {
              setCountry(code);
              setSaved(false);
            }}
          />
        </Field>

        <SecondaryButton type="submit" disabled={!dirty || pending}>
          {t('saveChanges')}
        </SecondaryButton>
      </form>
    </Section>
  );
}
