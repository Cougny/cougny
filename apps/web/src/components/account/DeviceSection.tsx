'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { AuthSessionSummary } from '@cougny/protocol';
import { FormError } from '@/components/auth/fields';
import { Section, SecondaryButton } from '@/components/account/Section';
import { fetchSessions, revokeOtherSessions, revokeSession } from '@/lib/auth';

/**
 * Signed-in devices, with a way to end any of them.
 *
 * This is the recovery path for a refresh token that leaked: ending the other
 * sessions takes effect immediately, because every request re-checks its
 * session rather than trusting the access token alone.
 */
export function DeviceSection({ token }: { token: string }): React.ReactElement {
  const t = useTranslations('account');
  const locale = useLocale();

  const [sessions, setSessions] = useState<AuthSessionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    void fetchSessions(token)
      .then((result) => setSessions(result.sessions))
      .catch(() => setError(t('deviceLoadFailed')));
  }, [token, t]);

  useEffect(load, [load]);

  const end = (id: string): void => {
    setError(null);
    void revokeSession(token, id)
      .then(load)
      .catch(() => setError(t('saveFailed')));
  };

  const endOthers = (): void => {
    setError(null);
    void revokeOtherSessions(token)
      .then(load)
      .catch(() => setError(t('saveFailed')));
  };

  const formatDateTime = (iso: string): string =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    );

  return (
    <Section title={t('devicesTitle')} description={t('devicesDescription')}>
      <div className="space-y-4">
        <FormError message={error} />

        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {sessions.map((session) => (
            <li key={session.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {/* The user agent is the only handle we have on a device; it
                      is displayed as text and never interpreted. */}
                  {session.userAgent ?? t('unknownDevice')}
                  {session.current && (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      {t('thisDevice')}
                    </span>
                  )}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t('lastActive', { date: formatDateTime(session.lastUsedAt) })}
                </p>
              </div>
              {!session.current && (
                <SecondaryButton tone="danger" onClick={() => end(session.id)}>
                  {t('signOutDevice')}
                </SecondaryButton>
              )}
            </li>
          ))}
        </ul>

        {sessions.length > 1 && (
          <SecondaryButton tone="danger" onClick={endOthers}>
            {t('signOutOthers')}
          </SecondaryButton>
        )}
      </div>
    </Section>
  );
}
