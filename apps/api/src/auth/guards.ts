import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma, UserStatus, type User } from '@cougny/db';
import { verifyAccessToken } from './tokens.js';

export interface AuthenticatedCaller {
  user: User;
  /** The device the access token descends from. */
  authSessionId: string;
}

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
}

/**
 * Resolves the signed-in account, or replies and returns null so handlers can
 * early-return.
 *
 * The access token's signature is necessary but not sufficient: the backing
 * `AuthSession` is checked on every request. That is what makes revocation —
 * "sign out everywhere", a password change, refresh-token reuse detection —
 * take effect at once instead of whenever the short-lived token happens to
 * expire.
 */
export async function requireUser(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<AuthenticatedCaller | null> {
  const token = bearerToken(request);
  const claims = token ? verifyAccessToken(token) : null;
  if (!claims) {
    reply.code(401).send({ error: { code: 'unauthorized', message: 'Sign in to continue.' } });
    return null;
  }

  const session = await prisma.authSession.findFirst({
    where: {
      id: claims.authSessionId,
      userId: claims.userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!session) {
    reply
      .code(401)
      .send({ error: { code: 'session_expired', message: 'Your session has ended.' } });
    return null;
  }

  if (session.user.status !== UserStatus.ACTIVE) {
    reply.code(403).send({
      error: {
        code: session.user.status === UserStatus.BANNED ? 'account_banned' : 'account_suspended',
        message: 'This account cannot be used.',
      },
    });
    return null;
  }

  // Cheap liveness signal for the account's device list; not awaited, because a
  // stale timestamp is never worth failing a request over.
  void prisma.authSession
    .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return { user: session.user, authSessionId: session.id };
}
