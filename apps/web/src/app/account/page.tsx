'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SiteHeader } from '@/components/SiteHeader';
import { useAuth } from '@/components/auth/AuthProvider';
import { ProfileSection } from '@/components/account/ProfileSection';
import { SecuritySection } from '@/components/account/SecuritySection';
import { PasskeySection } from '@/components/account/PasskeySection';
import { LinkedAccountsSection } from '@/components/account/LinkedAccountsSection';
import { DeviceSection } from '@/components/account/DeviceSection';
import { DangerSection } from '@/components/account/DangerSection';
import { SpinnerIcon } from '@/components/icons';

function Account(): React.ReactElement {
  const t = useTranslations('account');
  const router = useRouter();
  const params = useSearchParams();
  const { status, user, token } = useAuth();

  /*
   * The OAuth link flow redirects back here with its outcome in the query.
   * Derived from the URL during render rather than copied into state — the URL
   * is already the source of truth, and mirroring it would only add a frame
   * where the two disagree.
   */
  const notice =
    params.get('error') === 'already_linked'
      ? t('alreadyLinked')
      : params.get('linked')
        ? t('accountLinked')
        : null;

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
    else if (status === 'authenticated' && user && !user.profileComplete) {
      router.replace('/signup/complete');
    }
  }, [status, user, router]);

  if (status !== 'authenticated' || !user || !token || !user.profileComplete) {
    return (
      <div className="flex min-h-dvh flex-col">
        <SiteHeader />
        <div className="flex flex-1 items-center justify-center">
          <SpinnerIcon className="h-8 w-8 animate-spin text-brand" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          {t('title')}
        </h1>

        {notice && (
          <p
            role="status"
            className="mt-6 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
          >
            {notice}
          </p>
        )}

        <div className="space-y-10 pt-10">
          <ProfileSection user={user} token={token} />
          <SecuritySection user={user} token={token} />
          <PasskeySection token={token} />
          <LinkedAccountsSection user={user} token={token} />
          <DeviceSection token={token} />
          <DangerSection user={user} token={token} />
        </div>
      </main>
    </div>
  );
}

export default function AccountPage(): React.ReactElement {
  return (
    <Suspense>
      <Account />
    </Suspense>
  );
}
