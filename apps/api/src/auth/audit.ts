import type { FastifyRequest } from 'fastify';
import { prisma, type AuthEvent } from '@cougny/db';
import { requestMeta } from './request-meta.js';

interface AuditContext {
  /** Null for events that happen without a resolvable account (failed logins). */
  userId?: string | null;
  request?: FastifyRequest;
  /** Short free-form context: a provider name, a revoked session id, … */
  detail?: string;
}

/**
 * Appends a security-relevant account event to the audit trail.
 *
 * Deliberately fire-and-forget: an account action must not fail because the
 * trail could not be written. A failure is logged and swallowed, so the caller
 * never has to decide whether auditing is worth aborting a login over.
 */
export function recordAuthEvent(
  event: AuthEvent,
  { userId = null, request, detail }: AuditContext = {},
): void {
  const meta = request ? requestMeta(request) : { ipHash: null, userAgent: null };

  void prisma.authAuditLog
    .create({
      data: {
        event,
        userId,
        ipHash: meta.ipHash,
        userAgent: meta.userAgent,
        detail: detail ?? null,
      },
    })
    .catch((error: unknown) => {
      request?.log.warn({ err: error, event }, 'failed to write auth audit entry');
    });
}
