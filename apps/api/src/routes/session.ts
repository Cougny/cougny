import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createHash } from 'node:crypto';
import { prisma } from '@cougny/db';
import { CreateSessionResponseSchema, type CreateSessionResponse } from '@cougny/protocol';
import { signSessionToken } from '../tokens.js';

/**
 * Anonymous session bootstrap. The client calls this once on first load and
 * stores the returned token; it authorizes the signaling socket and API calls.
 */
export async function registerSessionRoutes(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/sessions',
    {
      schema: {
        tags: ['session'],
        summary: 'Create an anonymous session',
        response: { 200: CreateSessionResponseSchema },
      },
    },
    async (request): Promise<CreateSessionResponse> => {
      const ipHash = request.ip ? createHash('sha256').update(request.ip).digest('hex') : null;

      const session = await prisma.session.create({
        data: {
          ipHash,
          userAgent: request.headers['user-agent'] ?? null,
          locale: parseLocale(request.headers['accept-language']),
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
