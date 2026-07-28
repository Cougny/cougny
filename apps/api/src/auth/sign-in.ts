import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@cougny/db';
import type { AuthResponse } from '@cougny/protocol';
import { loadUserProfile } from './profile.js';
import { issueSession, setRefreshCookie } from './sessions.js';
import { signAccessToken } from './tokens.js';

/**
 * The last step of every way into an account — password, social, or passkey.
 *
 * Centralized so all three produce exactly the same result: a fresh rotation
 * family, the refresh token in an httpOnly cookie, and a short-lived access
 * token in the body. A new sign-in method only has to establish *who* the user
 * is; it never re-implements what being signed in means.
 */
export async function completeSignIn(
  userId: string,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<AuthResponse> {
  const { session, refreshToken } = await issueSession(userId, request);
  setRefreshCookie(reply, refreshToken);

  const { token, expiresAt } = signAccessToken(userId, session.id);
  const user = await loadUserProfile(userId);
  if (!user) throw new Error(`Signed in a user that no longer exists: ${userId}`);

  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });

  return { accessToken: token, expiresAt, user };
}
