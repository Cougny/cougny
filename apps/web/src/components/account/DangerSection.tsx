'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { UserProfile } from '@cougny/protocol';
import { Field, FormError, TextInput } from '@/components/auth/fields';
import { Section, SecondaryButton } from '@/components/account/Section';
import { useAuth } from '@/components/auth/AuthProvider';
import { AuthError, deleteAccount } from '@/lib/auth';

interface Props {
  user: UserProfile;
  token: string;
}

/**
 * Account deletion.
 *
 * Two-step and password-gated, because it cannot be undone. Call and report
 * history survives deletion — those records hang off anonymous sessions, and
 * removing them would erase moderation evidence about other people, not just
 * about the person leaving.
 */
export function DangerSection({ user, token }: Props): React.ReactElement {
  const t = useTranslations('account');
  const router = useRouter();
  const { signOut } = useAuth();

  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = (): void => {
    setPending(true);
    setError(null);

    void (async () => {
      try {
        await deleteAccount(token, user.hasPassword ? password : undefined);
        // Clears the in-memory token and the refresh cookie before navigating.
        await signOut();
        router.push('/');
      } catch (err) {
        setError(
          err instanceof AuthError && err.code === 'invalid_credentials'
            ? t('currentPasswordWrong')
            : t('deleteFailed'),
        );
        setPending(false);
      }
    })();
  };

  return (
    <Section title={t('deleteTitle')} description={t('deleteDescription')}>
      {confirming ? (
        <div className="space-y-4">
          <FormError message={error} />
          <p className="text-sm font-medium text-red-600 dark:text-red-400">{t('deleteConfirm')}</p>

          {user.hasPassword && (
            <Field id="deletePassword" label={t('currentPassword')}>
              <TextInput
                id="deletePassword"
                name="deletePassword"
                type="password"
                autoComplete="current-password"
                value={password}
                disabled={pending}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
          )}

          <div className="flex gap-2">
            <SecondaryButton
              tone="danger"
              onClick={remove}
              disabled={pending || (user.hasPassword && password === '')}
            >
              {t('deleteForever')}
            </SecondaryButton>
            <SecondaryButton onClick={() => setConfirming(false)} disabled={pending}>
              {t('cancel')}
            </SecondaryButton>
          </div>
        </div>
      ) : (
        <SecondaryButton tone="danger" onClick={() => setConfirming(true)}>
          {t('deleteAccount')}
        </SecondaryButton>
      )}
    </Section>
  );
}
