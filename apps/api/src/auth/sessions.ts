import { randomUUID } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma, AuthEvent, type AuthSession } from '@cougny/db';
import { env } from '../env.js';
import { recordAuthEvent } from './audit.js';
import { requestMeta } from './request-meta.js';
import { generateOpaqueToken, hashOpaqueToken } from './tokens.js';

/**
 * The refresh token rides in an httpOnly cookie, never in a response body, so
 * script running in the page — including anything injected into it — cannot
 * read it. Scoped to the auth prefix so it is not attached to ordinary API
 * calls that have no use for it.
 */
const REFRESH_COOKIE_NAME = 'cougny.refresh';
const REFRESH_COOKIE_PATH = '/v1/auth';

function refreshCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'none' | 'lax';
  path: string;
  domain?: string;
} {
  return {
    httpOnly: true,
    secure: env.cookiesSecure,
    /**
     * The web app and the API are separate origins in production, which makes
     * every refresh a cross-site request — `lax` would drop the cookie. `none`
     * requires `secure`, hence the local-development fallback.
     */
    sameSite: env.cookiesSecure ? 'none' : 'lax',
    path: REFRESH_COOKIE_PATH,
    ...(env.AUTH_COOKIE_DOMAIN ? { domain: env.AUTH_COOKIE_DOMAIN } : {}),
  };
}

export function setRefreshCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(REFRESH_COOKIE_NAME, token, {
    ...refreshCookieOptions(),
    maxAge: env.AUTH_REFRESH_TOKEN_TTL,
  });
}

export function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
}

export function readRefreshCookie(request: FastifyRequest): string | null {
  return request.cookies[REFRESH_COOKIE_NAME] ?? null;
}

function expiryFromNow(): Date {
  return new Date(Date.now() + env.AUTH_REFRESH_TOKEN_TTL * 1000);
}

export interface IssuedSession {
  session: AuthSession;
  /** The plaintext token — returned once, and only ever stored hashed. */
  refreshToken: string;
}

/**
 * Starts a new signed-in device. Each login opens its own rotation family, so
 * revoking one compromised chain never signs the user out of their other
 * devices.
 */
export async function issueSession(
  userId: string,
  request: FastifyRequest,
): Promise<IssuedSession> {
  const refreshToken = generateOpaqueToken();
  const meta = requestMeta(request);

  const session = await prisma.authSession.create({
    data: {
      userId,
      tokenHash: hashOpaqueToken(refreshToken),
      familyId: randomUUID(),
      expiresAt: expiryFromNow(),
      ipHash: meta.ipHash,
      userAgent: meta.userAgent,
    },
  });

  return { session, refreshToken };
}

export type RotateResult =
  | { outcome: 'rotated'; session: AuthSession; refreshToken: string }
  | { outcome: 'invalid' }
  /** The token was real but already spent — see {@link rotateSession}. */
  | { outcome: 'reused' };

/**
 * Trades a refresh token for its successor.
 *
 * Rotation is what makes a stolen refresh token detectable. Every token is
 * single-use: presenting one revokes it and mints a replacement in the same
 * family. So if a token is ever accepted twice, either the legitimate client or
 * a thief is replaying it — and since we cannot tell which, the entire family is
 * revoked and both are forced to sign in again.
 */
export async function rotateSession(
  refreshToken: string,
  request: FastifyRequest,
): Promise<RotateResult> {
  const existing = await prisma.authSession.findUnique({
    where: { tokenHash: hashOpaqueToken(refreshToken) },
  });

  if (!existing) return { outcome: 'invalid' };

  if (existing.revokedAt) {
    await prisma.authSession.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    recordAuthEvent(AuthEvent.TOKEN_REUSE_DETECTED, {
      userId: existing.userId,
      request,
      detail: `family ${existing.familyId}`,
    });
    return { outcome: 'reused' };
  }

  if (existing.expiresAt.getTime() <= Date.now()) return { outcome: 'invalid' };

  const nextToken = generateOpaqueToken();
  const meta = requestMeta(request);

  // One transaction so a crash can never leave both tokens live at once.
  const [, session] = await prisma.$transaction([
    prisma.authSession.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    }),
    prisma.authSession.create({
      data: {
        userId: existing.userId,
        tokenHash: hashOpaqueToken(nextToken),
        familyId: existing.familyId,
        expiresAt: expiryFromNow(),
        ipHash: meta.ipHash,
        userAgent: meta.userAgent,
      },
    }),
  ]);

  return { outcome: 'rotated', session, refreshToken: nextToken };
}

/** Signs out one device. Idempotent: revoking an already-revoked row is a no-op. */
export async function revokeSession(sessionId: string, userId: string): Promise<boolean> {
  const { count } = await prisma.authSession.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count > 0;
}

/**
 * Signs out every device. Used by "sign out everywhere" and, automatically,
 * whenever the password changes — a password change should end any session an
 * attacker established with the old one.
 */
export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
  const { count } = await prisma.authSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
  return count;
}
