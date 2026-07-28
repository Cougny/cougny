'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { OAuthProvider } from '@cougny/protocol';
import { startOAuth } from '@/lib/auth';
import { useOAuthProviders } from '@/hooks/useOAuthProviders';
import { DiscordIcon, GoogleIcon } from '@/components/icons';

const PROVIDER_ICONS: Record<OAuthProvider, (props: { className?: string }) => React.ReactElement> =
  {
    google: GoogleIcon,
    discord: DiscordIcon,
  };

interface SocialButtonsProps {
  /** `link` attaches the identity to the signed-in account instead. */
  mode: 'login' | 'link';
  /** Required for `link`; the server takes the target account from it. */
  token?: string;
  /** Providers already attached, hidden in `link` mode. */
  exclude?: OAuthProvider[];
  onError?: (message: string) => void;
}

/**
 * Sign in — or link — with Google or Discord.
 *
 * The provider list comes from the server rather than from build-time
 * constants, so a deployment that has not configured a provider's credentials
 * never shows a button that could only fail.
 */
export function SocialButtons({
  mode,
  token,
  exclude = [],
  onError,
}: SocialButtonsProps): React.ReactElement | null {
  const t = useTranslations('account');
  const providers = useOAuthProviders();
  const [pending, setPending] = useState<OAuthProvider | null>(null);

  const available = providers.filter((provider) => !exclude.includes(provider));
  if (available.length === 0) return null;

  const begin = (provider: OAuthProvider): void => {
    setPending(provider);
    void startOAuth(provider, mode, token)
      .then((url) => {
        // A full navigation, not a popup: the provider sets its own cookies and
        // some block being framed.
        window.location.href = url;
      })
      .catch(() => {
        setPending(null);
        onError?.(t('socialError'));
      });
  };

  return (
    <div className="space-y-2">
      {available.map((provider) => {
        const Icon = PROVIDER_ICONS[provider];
        return (
          <button
            key={provider}
            type="button"
            disabled={pending !== null}
            onClick={() => begin(provider)}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <Icon className="h-4 w-4" />
            {mode === 'link'
              ? t(provider === 'google' ? 'linkGoogle' : 'linkDiscord')
              : t(provider === 'google' ? 'continueWithGoogle' : 'continueWithDiscord')}
          </button>
        );
      })}
    </div>
  );
}
