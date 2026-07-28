import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createHash } from 'node:crypto';
import { prisma } from '@cougny/db';
import {
  CreateSessionResponseSchema,
  ErrorResponseSchema,
  type CreateSessionResponse,
} from '@cougny/protocol';
import { requireUser } from '../auth/guards.js';
import { isProfileComplete } from '../auth/profile.js';
import { signSessionToken } from '../tokens.js';

/**
 * Call-session bootstrap. The client calls this before its first call and
 * stores the returned token; it authorizes the signaling socket and API calls.
 *
 * An account is required. Calls are face-to-face with a stranger, so every
 * participant must be attached to an identity that carries an 18+ attestation
 * and can be acted on if they are reported — a browser-local consent checkbox
 * proved neither. The check is here, not only in the UI, because the UI can be
 * skipped and this endpoint cannot.
 *
 * The session itself stays pseudonymous on the wire: peers still only ever see
 * a session id, never the account behind it.
 */
export async function registerSessionRoutes(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/sessions',
    {
      // Per IP: sessions are minted once per browser and cached client-side,
      // so anything beyond a trickle is a bot loop.
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags: ['session'],
        summary: 'Create a call session for the signed-in account',
        security: [{ bearerAuth: [] }],
        response: {
          200: CreateSessionResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          429: ErrorResponseSchema,
        },
      },
    },
    async (request, reply): Promise<CreateSessionResponse | void> => {
      const caller = await requireUser(request, reply);
      if (!caller) return;

      // A social sign-up that never finished has no date of birth on file, so
      // the 18+ requirement has not actually been met yet.
      if (!isProfileComplete(caller.user)) {
        reply.code(403).send({
          error: {
            code: 'profile_incomplete',
            message: 'Finish setting up your account before starting a call.',
          },
        });
        return;
      }

      const ipHash = request.ip ? createHash('sha256').update(request.ip).digest('hex') : null;

      const session = await prisma.session.create({
        data: {
          ipHash,
          userAgent: request.headers['user-agent'] ?? null,
          locale: parseLocale(request.headers['accept-language']),
          userId: caller.user.id,
        },
        select: { id: true },
      });

      const { token, expiresAt } = signSessionToken(session.id);
      return { sessionId: session.id, token, expiresAt };
    },
  );
}

function parseLocale(header: string | undefined): string | null {
  if (!header) return null;
  return header.split(',')[0]?.trim().slice(0, 10) ?? null;
}
