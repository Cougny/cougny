'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { isCountryCode, type CountryCode, type UserProfile } from '@cougny/protocol';
import { CountrySelect } from '@/components/auth/CountrySelect';
import { Field, FormError, FormSuccess, TextInput } from '@/components/auth/fields';
import { Section, SecondaryButton, ReadOnlyField } from '@/components/account/Section';
import { useAuth } from '@/components/auth/AuthProvider';
import { resendVerificationEmail, updateProfile } from '@/lib/auth';

interface Props {
  index: number;
  user: UserProfile;
  token: string;
}

/** Display name and country — the profile fields a user may change freely. */
export function ProfileSection({ index, user, token }: Props): React.ReactElement {
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
    <Section index={index} title={t('profileTitle')} description={t('profileDescription')}>
      <form onSubmit={save} className="space-y-4">
        <FormError message={error} />
        {saved && <FormSuccess message={t('saved')} />}

        {/* Read-only identity. Changing a username or an age attestation is a
            support action, not a form field, so both are shown rather than
            edited. Set on a tinted panel so the whole group reads at a glance
            as the part of this section that cannot be typed into. */}
        <div className="grid gap-5 rounded-2xl bg-neutral-900/[0.03] p-5 ring-1 ring-inset ring-neutral-900/[0.06] sm:grid-cols-2 dark:bg-white/[0.03] dark:ring-white/10">
          <ReadOnlyField label={t('username')}>{user.username ?? '—'}</ReadOnlyField>
          <ReadOnlyField label={t('dateOfBirth')}>
            {user.dateOfBirth
              ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
                  new Date(`${user.dateOfBirth}T00:00:00Z`),
                )
              : '—'}
          </ReadOnlyField>
        </div>

        {/* The address itself is in the page's masthead; what belongs here is
            the one thing an unverified account can do about it. */}
        {user.email && !user.emailVerified && (
          <div>
            {verificationSent ? (
              <FormSuccess message={t('verificationSent')} />
            ) : (
              <SecondaryButton onClick={resend}>{t('resendVerification')}</SecondaryButton>
            )}
          </div>
        )}

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

        <SecondaryButton tone="primary" type="submit" disabled={!dirty || pending}>
          {t('saveChanges')}
        </SecondaryButton>
      </form>
    </Section>
  );
}
