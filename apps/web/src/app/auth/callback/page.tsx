'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/components/auth/AuthProvider';
import { SpinnerIcon } from '@/components/icons';

/**
 * Where a social sign-in lands after the provider redirect.
 *
 * The API deliberately sent no token in the URL — only the refresh cookie was
 * set — so this page trades that cookie for an access token and then routes on.
 * Keeping the credential out of the URL keeps it out of browser history, the
 * `Referer` header, and any proxy log along the way.
 */
export default function OAuthCallbackPage(): React.ReactElement {
  const t = useTranslations('account');
  const router = useRouter();
  const { status, user } = useAuth();
  const routed = useRef(false);

  useEffect(() => {
    // The provider set the cookie; `AuthProvider` refreshes on mount, so this
    // page only has to wait for that to resolve and then decide where to go.
    if (routed.current || status === 'loading') return;
    routed.current = true;

    if (status === 'anonymous') {
      router.replace('/login?error=provider_error');
      return;
    }
    router.replace(user?.profileComplete ? '/' : '/signup/complete');
  }, [status, user, router]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <SpinnerIcon className="h-8 w-8 animate-spin text-brand" />
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('signingIn')}</p>
    </main>
  );
}
