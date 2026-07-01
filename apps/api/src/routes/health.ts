import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { HealthResponseSchema, type HealthResponse } from '@cougny/protocol';

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/healthz',
    {
      schema: {
        tags: ['system'],
        summary: 'Liveness probe',
        response: { 200: HealthResponseSchema },
      },
    },
    async (): Promise<HealthResponse> => {
      return { status: 'ok', service: 'api', uptime: process.uptime() };
    },
  );
}
