import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  ErrorResponseSchema,
  IceServersResponseSchema,
  type IceServersResponse,
} from '@cougny/protocol';
import { requireSession } from '../auth.js';
import { mintIceServers } from '../turn.js';

/**
 * Hand the browser its ICE server list (STUN + freshly minted TURN
 * credentials). Requires a valid session so credentials aren't handed to
 * anonymous scrapers.
 */
export async function registerIceRoutes(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/ice-servers',
    {
      schema: {
        tags: ['webrtc'],
        summary: 'Get STUN/TURN servers with ephemeral credentials',
        security: [{ bearerAuth: [] }],
        response: {
          200: IceServersResponseSchema,
          401: ErrorResponseSchema,
        },
      },
    },
    async (request, reply): Promise<IceServersResponse | void> => {
      const sessionId = requireSession(request, reply);
      if (!sessionId) return;
      return mintIceServers(sessionId);
    },
  );
}
