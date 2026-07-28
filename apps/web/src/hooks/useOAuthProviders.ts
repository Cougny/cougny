import { useEffect, useState } from 'react';
import type { OAuthProvider } from '@cougny/protocol';
import { fetchCapabilities } from '@/lib/auth';

/**
 * The social providers this deployment has actually configured.
 *
 * Empty until the answer arrives, and empty if it never does: offering nothing
 * is the safe failure, because a button that cannot work is worse than no
 * button. Callers use it both to render the providers and to decide whether the
 * surrounding chrome — a divider, a heading — has anything to divide.
 */
export function useOAuthProviders(): OAuthProvider[] {
  const [providers, setProviders] = useState<OAuthProvider[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetchCapabilities()
      .then((capabilities) => {
        if (!cancelled) setProviders(capabilities.oauthProviders);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return providers;
}
