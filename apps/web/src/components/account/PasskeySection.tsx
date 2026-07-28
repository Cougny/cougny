'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { startRegistration } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';
import type { PasskeySummary } from '@cougny/protocol';
import { FormError, FormSuccess } from '@/components/auth/fields';
import { Section, SecondaryButton } from '@/components/account/Section';
import { useWebAuthnSupport } from '@/hooks/useWebAuthnSupport';
import { PasskeyIcon } from '@/components/icons';
import {
  AuthError,
  fetchPasskeys,
  finishPasskeyRegistration,
  passkeyRegistrationOptions,
  removePasskey,
  renamePasskey,
} from '@/lib/auth';

/**
 * Registered passkeys, and the button to add one.
 *
 * Single-device passkeys are flagged: unlike a synced one, losing that device
 * loses the credential, and a user should know which kind they have before it
 * becomes their only way in.
 */
export function PasskeySection({ token }: { token: string }): React.ReactElement | null {
  const t = useTranslations('account');
  const locale = useLocale();

  const supported = useWebAuthnSupport();
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  /** Id of the passkey being renamed inline, and the in-progress label. */
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const load = useCallback(() => {
    void fetchPasskeys(token)
      .then((result) => setPasskeys(result.passkeys))
      .catch(() => setError(t('passkeyLoadFailed')));
  }, [token, t]);

  useEffect(load, [load]);

  const add = (): void => {
    setPending(true);
    setError(null);
    setAdded(false);

    void (async () => {
      try {
        const options = (await passkeyRegistrationOptions(
          token,
        )) as unknown as PublicKeyCredentialCreationOptionsJSON;
        const attestation = await startRegistration({ optionsJSON: options });
        await finishPasskeyRegistration(
          token,
          attestation as unknown as Record<string, unknown>,
          // A recognizable default label; the list lets it be renamed after.
          navigator.platform || undefined,
        );
        setAdded(true);
        load();
      } catch (err) {
        // Dismissing the platform sheet throws `NotAllowedError`. That is the
        // user saying "not now", not something to show an error for.
        if (err instanceof Error && err.name === 'NotAllowedError') return;
        setError(
          err instanceof AuthError && err.code === 'already_registered'
            ? t('passkeyAlreadyRegistered')
            : t('passkeyError'),
        );
      } finally {
        setPending(false);
      }
    })();
  };

  /** Commits an inline rename, or simply exits edit mode if nothing changed. */
  const rename = (id: string): void => {
    const name = draftName.trim();
    setRenaming(null);

    const current = passkeys.find((passkey) => passkey.id === id);
    if (name === '' || name === current?.name) return;

    void renamePasskey(token, id, name)
      .then(load)
      .catch(() => setError(t('passkeyError')));
  };

  const remove = (id: string): void => {
    setError(null);
    void removePasskey(token, id)
      .then(load)
      .catch((err: unknown) => {
        setError(
          err instanceof AuthError && err.code === 'last_sign_in_method'
            ? t('lastSignInMethod')
            : t('passkeyError'),
        );
      });
  };

  if (!supported && passkeys.length === 0) return null;

  const formatDate = (iso: string): string =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));

  return (
    <Section title={t('passkeysTitle')} description={t('passkeysDescription')}>
      <div className="space-y-4">
        <FormError message={error} />
        {added && <FormSuccess message={t('passkeyAdded')} />}

        {passkeys.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('noPasskeys')}</p>
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {passkeys.map((passkey) => (
              <li key={passkey.id} className="flex items-center justify-between gap-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <PasskeyIcon className="h-5 w-5 shrink-0 text-neutral-400" />
                  <div className="min-w-0">
                    {renaming === passkey.id ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          rename(passkey.id);
                        }}
                      >
                        <input
                          autoFocus
                          maxLength={60}
                          value={draftName}
                          onChange={(event) => setDraftName(event.target.value)}
                          onBlur={() => rename(passkey.id)}
                          aria-label={t('passkeyName')}
                          className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm text-neutral-900 focus:border-brand focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                        />
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setRenaming(passkey.id);
                          setDraftName(passkey.name ?? '');
                        }}
                        title={t('renamePasskey')}
                        className="block max-w-full truncate text-left text-sm font-medium text-neutral-900 hover:underline dark:text-neutral-100"
                      >
                        {passkey.name ?? t('unnamedPasskey')}
                      </button>
                    )}
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {passkey.lastUsedAt
                        ? t('lastUsed', { date: formatDate(passkey.lastUsedAt) })
                        : t('addedOn', { date: formatDate(passkey.createdAt) })}
                      {!passkey.backedUp && ` · ${t('singleDevicePasskey')}`}
                    </p>
                  </div>
                </div>
                <SecondaryButton tone="danger" onClick={() => remove(passkey.id)}>
                  {t('remove')}
                </SecondaryButton>
              </li>
            ))}
          </ul>
        )}

        {supported && (
          <SecondaryButton onClick={add} disabled={pending}>
            {t('addPasskey')}
          </SecondaryButton>
        )}
      </div>
    </Section>
  );
}
