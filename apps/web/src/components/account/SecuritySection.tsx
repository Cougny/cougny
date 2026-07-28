'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { UserProfile } from '@cougny/protocol';
import { Field, FormError, FormSuccess, TextInput } from '@/components/auth/fields';
import { Section, SecondaryButton } from '@/components/account/Section';
import { useAuth } from '@/components/auth/AuthProvider';
import { AuthError, changePassword } from '@/lib/auth';

interface Props {
  user: UserProfile;
  token: string;
}

/**
 * Password management. An account created socially has none yet, so the same
 * form doubles as "set a password" — with no current password to ask for.
 */
export function SecuritySection({ user, token }: Props): React.ReactElement {
  const t = useTranslations('account');
  const { reload } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mismatched = confirmation !== '' && newPassword !== confirmation;
  const ready = newPassword !== '' && !mismatched && (!user.hasPassword || currentPassword !== '');

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!ready) return;

    setPending(true);
    setError(null);
    setDone(false);

    void (async () => {
      try {
        await changePassword(token, {
          ...(user.hasPassword ? { currentPassword } : {}),
          newPassword,
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmation('');
        setDone(true);
        // The profile's `hasPassword` flips the first time one is set.
        await reload();
      } catch (err) {
        setError(
          err instanceof AuthError && err.code === 'invalid_credentials'
            ? t('currentPasswordWrong')
            : t('saveFailed'),
        );
      } finally {
        setPending(false);
      }
    })();
  };

  return (
    <Section
      title={t('passwordTitle')}
      description={user.hasPassword ? t('passwordDescription') : t('setPasswordDescription')}
    >
      <form onSubmit={submit} className="space-y-4">
        <FormError message={error} />
        {/* Says the other devices were signed out, because they were. */}
        {done && <FormSuccess message={t('passwordChanged')} />}

        {user.hasPassword && (
          <Field id="currentPassword" label={t('currentPassword')}>
            <TextInput
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              disabled={pending}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </Field>
        )}

        <Field id="newPassword" label={t('newPassword')} hint={t('passwordHint')}>
          <TextInput
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            value={newPassword}
            disabled={pending}
            onChange={(event) => setNewPassword(event.target.value)}
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

        <SecondaryButton type="submit" disabled={!ready || pending}>
          {user.hasPassword ? t('changePassword') : t('setPassword')}
        </SecondaryButton>
      </form>
    </Section>
  );
}
