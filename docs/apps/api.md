# apps/api — `@cougny/api`

The HTTP API: accounts, call sessions, WebRTC ICE/TURN credentials, and moderation
reports.

## Stack

- **Fastify 5**
- **fastify-type-provider-zod** — validation + serialization from Zod
- **@fastify/swagger** + **@fastify/swagger-ui** — generated OpenAPI + docs UI
- **@fastify/rate-limit** (+ **ioredis** when `REDIS_URL` is set) — abuse throttling
- **prom-client** — Prometheus metrics at `GET /metrics`
- **@cougny/db** (Prisma) and **@cougny/protocol** (contracts)
- **jsonwebtoken** for access and call-session tokens, signed with per-purpose
  keys derived from `AUTH_JWT_SECRET`
- **@node-rs/argon2** for password hashing (Argon2id, OWASP parameters)
- **@simplewebauthn/server** for passkeys
- **@fastify/cookie** for the httpOnly refresh cookie
- **nodemailer** for verification and password-reset mail

## Structure

```
src/
  index.ts              Entrypoint (listen + graceful shutdown)
  app.ts                buildApp(): plugins, rate limits, swagger, routes (no listen)
  env.ts                Zod-validated environment
  auth.ts               requireSession(): call-session bearer guard
  tokens.ts             Sign/verify call-session JWTs
  turn.ts               Mint ephemeral coturn HMAC credentials
  metrics.ts            Prometheus registry + request-duration histogram
  i18n/                 Server-side message catalogs (transactional mail)
  auth/
    guards.ts           requireUser(): account bearer guard, re-checks the session
    tokens.ts           Per-purpose key derivation; access, state, and opaque tokens
    passwords.ts        Argon2id hash/verify
    sessions.ts         Refresh-token rotation, reuse detection, cookies
    sign-in.ts          The single "you are now signed in" path
    oauth.ts            Google + Discord: PKCE, token exchange, profile
    passkeys.ts         WebAuthn ceremonies
    mailer.ts           Verification and reset mail (logs when SMTP is unset)
    profile.ts          Wire serialization; profile-completeness rule
    audit.ts            Fire-and-forget security event trail
  routes/
    health.ts           GET /healthz
    session.ts          POST /v1/sessions       (account required, rate-limited per IP)
    ice.ts              GET /v1/ice-servers
    reports.ts          POST /v1/reports        (participant-validated, rate-limited per session)
    auth.ts             /v1/auth/*              register, login, refresh, profile, passwords, email
    auth-sessions.ts    /v1/auth/sessions/*     signed-in device management
    oauth.ts            /v1/auth/oauth/*        Google and Discord
    passkeys.ts         /v1/auth/passkeys/*     WebAuthn
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

Two token types, kept strictly apart:

- **Account access token** (15 minutes) — proves who someone is. Guarded by
  [`requireUser`](../../apps/api/src/auth/guards.ts), which re-reads the backing
  `AuthSession` on every request, so revocation takes effect at once rather than
  whenever the short-lived token happens to lapse.
- **Call-session token** (7 days) — proves which call session a request belongs
  to, and carries nothing else. Guarded by
  [`requireSession`](../../apps/api/src/auth.ts).

Both are signed with keys **derived** from `AUTH_JWT_SECRET` via HMAC, one per
purpose. That domain separation is what makes it impossible to present a
call-session token where an account token is expected — its `sub` would
otherwise be read as a user id.

The refresh token is never in a response body: it is an httpOnly cookie scoped
to `/v1/auth`, rotated on every use, with reuse of a spent token revoking the
entire rotation family.

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
