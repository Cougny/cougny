# apps/api — `@cougny/api`

The HTTP API: anonymous sessions, WebRTC ICE/TURN credentials, and moderation
reports.

## Stack

- **Fastify 5**
- **fastify-type-provider-zod** — validation + serialization from Zod
- **@fastify/swagger** + **@fastify/swagger-ui** — generated OpenAPI + docs UI
- **@cougny/db** (Prisma) and **@cougny/protocol** (contracts)
- **jsonwebtoken** for anonymous session tokens

## Structure

```
src/
  index.ts              Entrypoint (listen + graceful shutdown)
  app.ts                buildApp(): plugins, swagger, routes (no listen)
  env.ts                Zod-validated environment
  auth.ts               requireSession(): bearer-token guard
  tokens.ts             Sign/verify session JWTs
  turn.ts               Mint ephemeral coturn HMAC credentials
  routes/
    health.ts           GET /healthz
    session.ts          POST /v1/sessions
    ice.ts              GET /v1/ice-servers
    reports.ts          POST /v1/reports
```

`buildApp()` is separate from `index.ts` so tests can use Fastify's `inject()`
without opening a port.

## Validation & docs from one source

The app installs the Zod validator/serializer compilers and registers Swagger
with `jsonSchemaTransform`. Each route declares a `schema` built from
[`@cougny/protocol`](../packages/protocol.md) schemas, which simultaneously:

- validates the request body,
- serializes (and validates) the response,
- generates the OpenAPI entry shown in Swagger UI at **`/docs`**.

Add a route with a `schema` and it is documented automatically. Full endpoint
list: [api-reference.md](../api-reference.md).

## Auth model

`POST /v1/sessions` issues an anonymous JWT (7-day expiry) carrying only a
session id. [`requireSession`](../../apps/api/src/auth.ts) validates the
`Authorization: Bearer` header on protected routes and replies `401` otherwise.

## TURN credentials

[`turn.ts`](../../apps/api/src/turn.ts) implements coturn's REST-API HMAC scheme;
covered in [webrtc.md](../webrtc.md#ice--turn-credentials) and unit-tested in
[`turn.test.ts`](../../apps/api/src/turn.test.ts).

## Environment

Validated on boot by [`env.ts`](../../apps/api/src/env.ts) — the process exits
with a clear message if anything is missing. Requires `DATABASE_URL`,
`AUTH_JWT_SECRET`, and `TURN_STATIC_AUTH_SECRET` (see
[infrastructure.md](../infrastructure.md#environment-matrix)).

## Scripts

```bash
pnpm --filter @cougny/api dev      # tsx watch, :4000
pnpm --filter @cougny/api build
pnpm --filter @cougny/api test
```
