import { useSyncExternalStore } from 'react';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';

/** WebAuthn support never changes for the life of a page, so nothing to watch. */
function subscribe(): () => void {
  return () => undefined;
}

/**
 * Whether this browser can do WebAuthn, safe to read during render.
 *
 * `browserSupportsWebAuthn` touches `window`, which does not exist while the
 * page is rendered on the server. `useSyncExternalStore` is the sanctioned way
 * to read that kind of value: the server snapshot is `false`, so the markup
 * matches on both sides, and the client swaps in the real answer during
 * hydration without an effect or a cascading re-render.
 */
export function useWebAuthnSupport(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => browserSupportsWebAuthn(),
    () => false,
  );
}
