import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifySessionToken } from './tokens.js';

/**
 * Resolve the session id from a `Authorization: Bearer <token>` header.
 * Replies 401 and returns null when the token is missing or invalid, so route
 * handlers can early-return.
 */
export function requireSession(request: FastifyRequest, reply: FastifyReply): string | null {
  const header = request.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  const claims = token ? verifySessionToken(token) : null;

  if (!claims) {
    reply.code(401).send({ error: { code: 'unauthorized', message: 'Valid session required.' } });
    return null;
  }
  return claims.sub;
}
