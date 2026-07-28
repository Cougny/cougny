import { readFileSync } from 'node:fs';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
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
import { registerAuthRoutes } from './routes/auth.js';
import { registerAuthSessionRoutes } from './routes/auth-sessions.js';
import { registerOAuthRoutes } from './routes/oauth.js';
import { registerPasskeyRoutes } from './routes/passkeys.js';

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

  // Reads the refresh-token and OAuth/WebAuthn ceremony cookies. Their values
  // are already signed or hashed by the auth layer, so no cookie secret here.
  await app.register(cookie);

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

  /*
   * One error shape for the whole API: `{ error: { code, message } }`, which is
   * what `ErrorResponseSchema` documents and what clients narrow on.
   *
   * Without this, two things go wrong. Request-validation failures come back in
   * Fastify's own `{ statusCode, code, error, message }` shape — which a route
   * that documents a 400 then fails to serialize, turning a bad request into a
   * 500. And unhandled exceptions serialize their own message, which for a
   * database error means echoing the failing query and a source path back to
   * the caller.
   */
  app.setErrorHandler((rawError, request, reply) => {
    // Annotated explicitly: with the Zod type provider the handler's parameter
    // is inferred as `unknown`, and every error Fastify routes here is a
    // `FastifyError` regardless.
    const error = rawError as FastifyError;

    if (error.validation) {
      reply.code(400).send({ error: { code: 'invalid_request', message: error.message } });
      return;
    }

    // Errors thrown already carrying the envelope — rate limiting builds one.
    const enveloped = error as unknown as { error?: { code?: string; message?: string } };
    if (enveloped.error?.code && enveloped.error.message) {
      reply.code(error.statusCode ?? 500).send({ error: enveloped.error });
      return;
    }

    const status = error.statusCode ?? 500;
    if (status >= 500) {
      // Logged in full, reported as nothing: the details are for us.
      request.log.error({ err: error }, 'request failed');
      reply.code(status).send({
        error: { code: 'internal_error', message: 'Something went wrong.' },
      });
      return;
    }

    reply.code(status).send({
      error: { code: error.code ?? 'request_failed', message: error.message },
    });
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
          'HTTP API for Cougny: accounts, call sessions, WebRTC ICE credentials, and moderation reports.',
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
        { name: 'session', description: 'Call session lifecycle' },
        {
          name: 'auth',
          description: 'Accounts: registration, sign-in, social identities, and passkeys',
        },
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

  // Accounts. Every route sits under /v1/auth so the refresh cookie can be
  // scoped to that path rather than sent with all API traffic.
  await app.register(registerAuthRoutes, { prefix: '/v1' });
  await app.register(registerAuthSessionRoutes, { prefix: '/v1' });
  await app.register(registerOAuthRoutes, { prefix: '/v1' });
  await app.register(registerPasskeyRoutes, { prefix: '/v1' });

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
