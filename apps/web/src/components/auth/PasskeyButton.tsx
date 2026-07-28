'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { startAuthentication } from '@simplewebauthn/browser';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import type { AuthResponse } from '@cougny/protocol';
import { finishPasskeyAuthentication, passkeyAuthenticationOptions } from '@/lib/auth';
import { useWebAuthnSupport } from '@/hooks/useWebAuthnSupport';
import { PasskeyIcon } from '@/components/icons';

interface PasskeyButtonProps {
  /** Optional: narrows the ceremony to one account's credentials. */
  email?: string;
  onSuccess: (response: AuthResponse) => void;
  onError: (message: string) => void;
}

/**
 * Signs in with a passkey.
 *
 * Hidden entirely on browsers without WebAuthn, rather than shown and failing
 * on click. The ceremony runs in the browser's own UI — the page never sees the
 * private key, and the browser will not release a signature to any origin but
 * this one, which is what makes a passkey unphishable.
 */
export function PasskeyButton({
  email,
  onSuccess,
  onError,
}: PasskeyButtonProps): React.ReactElement | null {
  const t = useTranslations('account');
  const supported = useWebAuthnSupport();
  const [pending, setPending] = useState(false);

  if (!supported) return null;

  const signIn = (): void => {
    setPending(true);
    void (async () => {
      try {
        const options = (await passkeyAuthenticationOptions(
          email,
        )) as unknown as PublicKeyCredentialRequestOptionsJSON;
        const assertion = await startAuthentication({ optionsJSON: options });
        onSuccess(
          await finishPasskeyAuthentication(assertion as unknown as Record<string, unknown>),
        );
      } catch (error) {
        // Dismissing the platform's passkey sheet throws too. That is a
        // deliberate "not now", not a failure worth putting an error on screen.
        if (!(error instanceof Error) || error.name !== 'NotAllowedError') {
          onError(t('passkeyError'));
        }
      } finally {
        setPending(false);
      }
    })();
  };

  return (
    <button
      type="button"
      onClick={signIn}
      disabled={pending}
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
    >
      <PasskeyIcon className="h-4 w-4" />
      {t('continueWithPasskey')}
    </button>
  );
}
