import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
} from 'fastify-type-provider-zod';
import { env } from './env.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerSessionRoutes } from './routes/session.js';
import { registerIceRoutes } from './routes/ice.js';
import { registerReportRoutes } from './routes/reports.js';

/**
 * Builds the Fastify instance with all plugins and routes registered but not
 * listening. Kept separate from the entrypoint so tests can `inject()` against
 * it without opening a port.
 *
 * Request/response validation and the OpenAPI document are both derived from
 * the shared Zod schemas in `@cougny/protocol`, so the docs can never drift
 * from what the API actually accepts and returns.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'development'
        ? { transport: { target: 'pino-pretty' } }
        : env.NODE_ENV !== 'test',
  });

  // Validate and serialize with Zod.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, {
    origin: env.corsOrigins,
    credentials: true,
  });

  // OpenAPI spec (generated from Zod) + interactive Swagger UI at /docs.
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Cougny API',
        description:
          'HTTP API for Cougny: anonymous sessions, WebRTC ICE credentials, and moderation reports.',
        version: '0.1.0',
      },
      servers: [{ url: `http://localhost:${env.API_PORT}`, description: 'Local development' }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      tags: [
        { name: 'system', description: 'Health and readiness' },
        { name: 'session', description: 'Anonymous session lifecycle' },
        { name: 'webrtc', description: 'ICE server / TURN credentials' },
        { name: 'moderation', description: 'Abuse reports' },
      ],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUI, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
  });

  await app.register(registerHealthRoutes);
  await app.register(registerSessionRoutes, { prefix: '/v1' });
  await app.register(registerIceRoutes, { prefix: '/v1' });
  await app.register(registerReportRoutes, { prefix: '/v1' });

  return app;
}
