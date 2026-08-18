'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SiteHeader } from '@/components/SiteHeader';
import { AuroraField } from '@/components/marketing/AuroraField';
import { Reveal } from '@/components/marketing/Reveal';
import { useAuth } from '@/components/auth/AuthProvider';
import { Pill } from '@/components/account/Section';
import { ProfileSection } from '@/components/account/ProfileSection';
import { SecuritySection } from '@/components/account/SecuritySection';
import { PasskeySection } from '@/components/account/PasskeySection';
import { LinkedAccountsSection } from '@/components/account/LinkedAccountsSection';
import { DeviceSection } from '@/components/account/DeviceSection';
import { DangerSection } from '@/components/account/DangerSection';
import { SpinnerIcon } from '@/components/icons';

/**
 * Account settings.
 *
 * Set like the landing page rather than like a settings panel: the same aurora
 * field behind it, the same ruled rows in place of cards, and the same
 * numbered running order down the left. Someone arriving here from the front
 * page should not feel they have crossed into a different product — which is
 * exactly what a column of grey boxes on a flat background did.
 */
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
      <div className="relative flex min-h-dvh flex-col">
        <AuroraField className="fixed inset-0 -z-10" vignette />
        <SiteHeader />
        <div className="flex flex-1 items-center justify-center">
          <SpinnerIcon className="h-8 w-8 animate-spin text-brand" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col">
      {/*
       * `fixed`, for the same reason the landing page pins its field: the
       * account page is as long as the number of passkeys and devices makes
       * it, and a field sized to that box would stretch its blobs to shapes
       * far larger than the ones tuned to look right.
       */}
      <AuroraField className="fixed inset-0 -z-10" vignette />

      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-14 sm:px-8 sm:pb-32 sm:pt-20">
        <Reveal variant="up">
          <header>
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand dark:text-violet-300">
              {t('title')}
            </span>
            {/*
             * The person, not the page. A settings screen headed "Account"
             * tells its reader something they knew before they clicked; their
             * own name tells them whose account they are looking at, which on
             * a product people hold two of is the useful fact.
             */}
            <h1 className="pt-4 text-[clamp(2rem,5vw,3rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-neutral-900 dark:text-white">
              {user.displayName ?? user.username ?? t('title')}
            </h1>
            {/*
             * The address, not the handle: the handle is either already the
             * headline above (when no display name is set) or one line down in
             * the profile panel, and the email is the thing someone checking
             * "which account am I in?" actually wants to see.
             */}
            {user.email && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-4 text-sm text-neutral-500 dark:text-neutral-400">
                <span>{user.email}</span>
                <Pill tone={user.emailVerified ? 'positive' : 'warning'}>
                  {user.emailVerified ? t('verified') : t('unverified')}
                </Pill>
              </div>
            )}
          </header>
        </Reveal>

        {notice && (
          <p
            role="status"
            className="mt-8 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:text-emerald-300 dark:ring-emerald-400/25"
          >
            {notice}
          </p>
        )}

        {/*
         * A rule above the first section closes the masthead off, so the
         * numbered list below reads as one table of contents rather than as
         * the heading and then some unrelated rows.
         */}
        <div className="mt-12 border-t border-neutral-200/80 dark:border-white/10">
          <ProfileSection index={1} user={user} token={token} />
          <SecuritySection index={2} user={user} token={token} />
          <PasskeySection index={3} token={token} />
          <LinkedAccountsSection index={4} user={user} token={token} />
          <DeviceSection index={5} token={token} />
          <DangerSection index={6} user={user} token={token} />
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
