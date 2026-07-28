import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma, AuthEvent } from '@cougny/db';
import {
  AuthSessionListResponseSchema,
  ErrorResponseSchema,
  OkResponseSchema,
  type AuthSessionListResponse,
  type OkResponse,
} from '@cougny/protocol';
import { recordAuthEvent } from '../auth/audit.js';
import { requireUser } from '../auth/guards.js';
import { revokeAllSessions, revokeSession } from '../auth/sessions.js';

const SessionIdParamsSchema = z.object({ id: z.string().min(1) });

/**
 * The account's signed-in devices.
 *
 * Being able to see and end other sessions is what makes a leaked refresh token
 * recoverable without a support ticket, so this is part of the account surface
 * rather than an admin tool.
 */
export async function registerAuthSessionRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/auth/sessions',
    {
      schema: {
        tags: ['auth'],
        summary: 'List signed-in devices',
        security: [{ bearerAuth: [] }],
        response: {
          200: AuthSessionListResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
        },
      },
    },
    async (request, reply): Promise<AuthSessionListResponse | void> => {
      const caller = await requireUser(request, reply);
      if (!caller) return;

      // Revoked and expired rows are rotation history, not devices — showing
      // them would list one entry per refresh rather than one per sign-in.
      const sessions = await prisma.authSession.findMany({
        where: { userId: caller.user.id, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { lastUsedAt: 'desc' },
      });

      return {
        sessions: sessions.map((session) => ({
          id: session.id,
          createdAt: session.createdAt.toISOString(),
          lastUsedAt: session.lastUsedAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
          userAgent: session.userAgent,
          current: session.id === caller.authSessionId,
        })),
      };
    },
  );

  typed.delete(
    '/auth/sessions/:id',
    {
      schema: {
        tags: ['auth'],
        summary: 'Sign out one device',
        security: [{ bearerAuth: [] }],
        params: SessionIdParamsSchema,
        response: {
          200: OkResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request, reply): Promise<OkResponse | void> => {
      const caller = await requireUser(request, reply);
      if (!caller) return;

      // Ending the current device here would leave the page in a confusing
      // half-signed-out state; `POST /auth/logout` is the route for that, and
      // it also clears the cookie.
      if (request.params.id === caller.authSessionId) {
        reply.code(409).send({
          error: { code: 'current_session', message: 'Use sign out to end this device.' },
        });
        return;
      }

      const revoked = await revokeSession(request.params.id, caller.user.id);
      if (!revoked) {
        reply.code(404).send({ error: { code: 'not_found', message: 'No such session.' } });
        return;
      }

      recordAuthEvent(AuthEvent.SESSION_REVOKED, {
        userId: caller.user.id,
        request,
        detail: request.params.id,
      });
      return { ok: true };
    },
  );

  typed.post(
    '/auth/sessions/revoke-others',
    {
      schema: {
        tags: ['auth'],
        summary: 'Sign out every other device',
        security: [{ bearerAuth: [] }],
        response: {
          200: OkResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
        },
      },
    },
    async (request, reply): Promise<OkResponse | void> => {
      const caller = await requireUser(request, reply);
      if (!caller) return;

      const count = await revokeAllSessions(caller.user.id, caller.authSessionId);
      if (count > 0) {
        recordAuthEvent(AuthEvent.SESSION_REVOKED, {
          userId: caller.user.id,
          request,
          detail: `${count} other devices`,
        });
      }
      return { ok: true };
    },
  );
}
