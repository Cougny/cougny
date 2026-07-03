import jwt from 'jsonwebtoken';
import { env } from './env.js';

/**
 * Verifies a session token minted by the API (`POST /v1/sessions`) and returns
 * the session id it authorizes, or null when the token is missing, malformed,
 * expired, or signed with a different secret. Both services share
 * `AUTH_JWT_SECRET`, so no network hop is needed to authenticate a socket.
 */
export function verifySessionToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, env.AUTH_JWT_SECRET);
    if (typeof decoded === 'object' && decoded && typeof decoded.sub === 'string') {
      return decoded.sub;
    }
    return null;
  } catch {
    return null;
  }
}
