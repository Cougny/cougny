'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { OAuthProvider, UserProfile } from '@cougny/protocol';
import { FormError } from '@/components/auth/fields';
import { SocialButtons } from '@/components/auth/SocialButtons';
import { Section, SecondaryButton } from '@/components/account/Section';
import { useAuth } from '@/components/auth/AuthProvider';
import { DiscordIcon, GoogleIcon } from '@/components/icons';
import { AuthError, unlinkOAuth } from '@/lib/auth';

const PROVIDER_ICONS: Record<OAuthProvider, (props: { className?: string }) => React.ReactElement> =
  {
    google: GoogleIcon,
    discord: DiscordIcon,
  };

interface Props {
  user: UserProfile;
  token: string;
}

/** Google and Discord identities attached to the account. */
export function LinkedAccountsSection({ user, token }: Props): React.ReactElement {
  const t = useTranslations('account');
  const locale = useLocale();
  const { reload } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const linked = user.linkedAccounts.map((account) => account.provider);

  const unlink = (provider: OAuthProvider): void => {
    setError(null);
    void unlinkOAuth(token, provider)
      .then(reload)
      .catch((err: unknown) => {
        // The server refuses to remove the last way into an account, which
        // would otherwise lock its owner out permanently.
        setError(
          err instanceof AuthError && err.code === 'last_sign_in_method'
            ? t('lastSignInMethod')
            : t('saveFailed'),
        );
      });
  };

  return (
    <Section title={t('linkedTitle')} description={t('linkedDescription')}>
      <div className="space-y-4">
        <FormError message={error} />

        {user.linkedAccounts.length > 0 && (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {user.linkedAccounts.map((account) => {
              const Icon = PROVIDER_ICONS[account.provider];
              return (
                <li key={account.provider} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon className="h-5 w-5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium capitalize text-neutral-900 dark:text-neutral-100">
                        {account.provider}
                      </p>
                      <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                        {account.label ??
                          t('linkedOn', {
                            date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                              new Date(account.linkedAt),
                            ),
                          })}
                      </p>
                    </div>
                  </div>
                  <SecondaryButton tone="danger" onClick={() => unlink(account.provider)}>
                    {t('unlink')}
                  </SecondaryButton>
                </li>
              );
            })}
          </ul>
        )}

        <SocialButtons mode="link" token={token} exclude={linked} onError={setError} />
      </div>
    </Section>
  );
}
