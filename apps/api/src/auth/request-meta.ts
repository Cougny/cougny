import { createHash } from 'node:crypto';
import type { FastifyRequest } from 'fastify';

/**
 * Coarse, non-identifying context recorded alongside sessions and audit
 * entries. The IP is hashed rather than stored: it is enough to correlate abuse
 * from one source, and not enough to reconstruct who someone is.
 */
export interface RequestMeta {
  ipHash: string | null;
  userAgent: string | null;
}

export function requestMeta(request: FastifyRequest): RequestMeta {
  return {
    ipHash: request.ip ? createHash('sha256').update(request.ip).digest('hex') : null,
    // Bounded: this string is attacker-controlled and ends up in the database.
    userAgent: request.headers['user-agent']?.slice(0, 400) ?? null,
  };
}
