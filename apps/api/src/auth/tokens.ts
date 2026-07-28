import { createHash, createHmac, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';

/**
 * Per-purpose signing keys, all derived from the one configured secret.
 *
 * The domain separation matters: without it, a token minted for one purpose
 * would verify as another — an anonymous call-session token could be presented
 * as an account access token, and its session id read as a user id. Deriving
 * the keys gets that guarantee without asking every deployment to configure a
 * secret per purpose.
 */
function deriveKey(purpose: string): Buffer {
  return createHmac('sha256', env.AUTH_JWT_SECRET).update(`cougny/${purpose}`).digest();
}

const ACCESS_TOKEN_KEY = deriveKey('access-token');
const OAUTH_STATE_KEY = deriveKey('oauth-state');
const WEBAUTHN_CHALLENGE_KEY = deriveKey('webauthn-challenge');

/* ------------------------------------------------------------------------- *
 * Access tokens
 * ------------------------------------------------------------------------- */

export interface AccessTokenClaims {
  /** The authenticated account. */
  userId: string;
  /**
   * The `AuthSession` this token descends from. Carrying it lets a request be
   * traced to one device, and lets "sign out everywhere" take effect without
   * waiting for the token to expire.
   */
  authSessionId: string;
}

export interface IssuedAccessToken {
  token: string;
  /** Unix seconds, so the client can refresh before it lapses. */
  expiresAt: number;
}

export function signAccessToken(userId: string, authSessionId: string): IssuedAccessToken {
  const token = jwt.sign({ sub: userId, sid: authSessionId }, ACCESS_TOKEN_KEY, {
    expiresIn: env.AUTH_ACCESS_TOKEN_TTL,
  });
  return { token, expiresAt: Math.floor(Date.now() / 1000) + env.AUTH_ACCESS_TOKEN_TTL };
}

export function verifyAccessToken(token: string): AccessTokenClaims | null {
  try {
    const decoded = jwt.verify(token, ACCESS_TOKEN_KEY);
    if (typeof decoded !== 'object' || !decoded) return null;
    const { sub, sid } = decoded as { sub?: unknown; sid?: unknown };
    if (typeof sub !== 'string' || typeof sid !== 'string') return null;
    return { userId: sub, authSessionId: sid };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------------- *
 * Opaque secrets (refresh tokens, email links)
 * ------------------------------------------------------------------------- */

/**
 * 256 bits from the CSPRNG. Opaque rather than a JWT because these are meant to
 * be revocable: the database row is the source of truth, so revoking one takes
 * effect immediately instead of at expiry.
 */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * What gets stored for an opaque token. The row is only a verifier, so a leak
 * of the database yields nothing an attacker can present.
 */
export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/* ------------------------------------------------------------------------- *
 * Short-lived ceremony state
 * ------------------------------------------------------------------------- */

/** How long a half-finished OAuth or WebAuthn ceremony stays valid. */
const CEREMONY_TTL_SECONDS = 10 * 60;

/**
 * OAuth state parked in the caller's cookie rather than a database row. It is
 * signed, so a client cannot rewrite where the flow lands or whose account an
 * identity gets attached to, and it expires on its own with nothing to clean up.
 */
export interface OAuthStateClaims {
  provider: string;
  /** CSRF nonce, echoed by the provider and compared on the way back. */
  state: string;
  /** PKCE verifier; its challenge went out with the authorization request. */
  codeVerifier: string;
  /** `link` attaches the identity to an account already signed in. */
  mode: 'login' | 'link';
  /** Present only for `link`, naming the account to attach to. */
  userId?: string;
}

export function signOAuthState(claims: OAuthStateClaims): string {
  return jwt.sign(claims, OAUTH_STATE_KEY, { expiresIn: CEREMONY_TTL_SECONDS });
}

export function verifyOAuthState(token: string): OAuthStateClaims | null {
  try {
    const decoded = jwt.verify(token, OAUTH_STATE_KEY);
    if (typeof decoded !== 'object' || !decoded) return null;
    const claims = decoded as Partial<OAuthStateClaims>;
    if (
      typeof claims.provider !== 'string' ||
      typeof claims.state !== 'string' ||
      typeof claims.codeVerifier !== 'string' ||
      (claims.mode !== 'login' && claims.mode !== 'link')
    ) {
      return null;
    }
    return {
      provider: claims.provider,
      state: claims.state,
      codeVerifier: claims.codeVerifier,
      mode: claims.mode,
      ...(claims.userId ? { userId: claims.userId } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * The challenge issued for a WebAuthn ceremony, held the same stateless way as
 * OAuth state. Binding it to a signed cookie is what stops one browser's
 * challenge from being answered by another.
 */
export interface WebAuthnChallengeClaims {
  challenge: string;
  ceremony: 'registration' | 'authentication';
  /** Set when the ceremony belongs to a known account. */
  userId?: string;
}

export function signWebAuthnChallenge(claims: WebAuthnChallengeClaims): string {
  return jwt.sign(claims, WEBAUTHN_CHALLENGE_KEY, { expiresIn: CEREMONY_TTL_SECONDS });
}

export function verifyWebAuthnChallenge(token: string): WebAuthnChallengeClaims | null {
  try {
    const decoded = jwt.verify(token, WEBAUTHN_CHALLENGE_KEY);
    if (typeof decoded !== 'object' || !decoded) return null;
    const claims = decoded as Partial<WebAuthnChallengeClaims>;
    if (
      typeof claims.challenge !== 'string' ||
      (claims.ceremony !== 'registration' && claims.ceremony !== 'authentication')
    ) {
      return null;
    }
    return {
      challenge: claims.challenge,
      ceremony: claims.ceremony,
      ...(claims.userId ? { userId: claims.userId } : {}),
    };
  } catch {
    return null;
  }
}
