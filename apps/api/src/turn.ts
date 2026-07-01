import { createHmac } from 'node:crypto';
import type { IceServer, IceServersResponse } from '@cougny/protocol';
import { env } from './env.js';

/**
 * Mint short-lived TURN credentials using coturn's REST-API scheme
 * (`use-auth-secret` / `static-auth-secret`).
 *
 * This is the self-hosted equivalent of what a paid TURN vendor sells:
 *   username   = "<unix-expiry>:<sessionId>"
 *   credential = base64( HMAC-SHA1( staticAuthSecret, username ) )
 *
 * coturn recomputes the same HMAC from its own copy of the shared secret, so
 * the secret never leaves our servers and each browser gets a credential that
 * auto-expires. Reference: coturn TURN REST API.
 */
export function mintIceServers(sessionId: string, now: number = Date.now()): IceServersResponse {
  const expiresAt = Math.floor(now / 1000) + env.TURN_CREDENTIAL_TTL;
  const username = `${expiresAt}:${sessionId}`;
  const credential = createHmac('sha1', env.TURN_STATIC_AUTH_SECRET)
    .update(username)
    .digest('base64');

  const iceServers: IceServer[] = [
    { urls: env.STUN_URL },
    { urls: env.TURN_URL, username, credential },
  ];

  return { iceServers, expiresAt };
}
