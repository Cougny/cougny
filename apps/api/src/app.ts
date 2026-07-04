import { readFileSync } from 'node:fs';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { Redis } from 'ioredis';
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
} from 'fastify-type-provider-zod';
import { env } from './env.js';
import { httpRequestDurationSeconds, registry } from './metrics.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerSessionRoutes } from './routes/session.js';
import { registerIceRoutes } from './routes/ice.js';
import { registerReportRoutes } from './routes/reports.js';

/**
 * Version advertised in the OpenAPI document. Read from this service's
 * package.json so the published spec always matches the deployed build rather
 * than drifting from a hardcoded literal. The relative path resolves the same
 * from `src/app.ts` and the compiled `dist/app.js`.
 */
const API_VERSION = (
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

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

  // Abuse throttling. With REDIS_URL set, counters are shared across API
  // instances; otherwise they live in-process. Routes tighten the generous
  // global ceiling via their own `config.rateLimit`.
  const redis = env.REDIS_URL
    ? new Redis(env.REDIS_URL, {
        // Recommended settings for rate limiting: fail fast, never queue.
        connectTimeout: 500,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      })
    : undefined;
  if (redis) app.addHook('onClose', () => redis.quit().then(() => undefined));

  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    redis,
    nameSpace: 'cougny:rl:',
    // If Redis is down, serve traffic unthrottled rather than serving 500s.
    skipOnError: true,
    // The plugin throws this value; statusCode tells Fastify's error handler
    // to reply 429 (or 403 on ban) and the Zod response serializer strips it,
    // leaving the standard error envelope on the wire.
    errorResponseBuilder: (_request, context) => ({
      statusCode: context.statusCode,
      error: {
        code: 'rate_limited',
        message: `Rate limit exceeded; retry in ${context.after}.`,
      },
    }),
  });

  // Request duration metrics for every route with a pattern (404s excluded).
  app.addHook('onResponse', (request, reply, done) => {
    const route = request.routeOptions.url;
    if (route && route !== '/metrics') {
      httpRequestDurationSeconds.observe(
        { method: request.method, route, status_code: reply.statusCode },
        reply.elapsedTime / 1000,
      );
    }
    done();
  });

  // OpenAPI spec (generated from Zod) + interactive Swagger UI at /docs.
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Cougny API',
        description:
          'HTTP API for Cougny: anonymous sessions, WebRTC ICE credentials, and moderation reports.',
        version: API_VERSION,
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

  // Prometheus scrape endpoint. Not part of the public API surface.
  app.get(
    '/metrics',
    { schema: { hide: true }, config: { rateLimit: false } },
    async (_, reply) => {
      reply.header('content-type', registry.contentType);
      return registry.metrics();
    },
  );

  return app;
}
