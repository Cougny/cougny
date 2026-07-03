# API Reference

The HTTP API is [`apps/api`](./apps/api.md) (Fastify). Base URL in development:
`http://localhost:4000`.

## Interactive docs (Swagger UI)

The API serves a live, generated OpenAPI document and Swagger UI:

- **Swagger UI:** http://localhost:4000/docs
- **OpenAPI JSON:** http://localhost:4000/docs/json

The spec is generated **from the same Zod schemas** used to validate requests
and serialize responses (via `fastify-type-provider-zod` +
`@fastify/swagger`), so it can't drift from the real behavior. Add a new
route with a `schema` and it appears in the docs automatically.

## Authentication

All endpoints except session creation and health require a bearer token — the
JWT returned by `POST /v1/sessions`:

```
Authorization: Bearer <token>
```

Tokens are anonymous (they carry only a session id) and expire after 7 days.

## Rate limiting

All routes are throttled (generous global ceiling per IP); session creation
(per IP) and reports (per session token) have tighter limits. Over-limit
requests get `429` with the standard error envelope and code `rate_limited`.
With `REDIS_URL` set, counters are shared across API instances.

## Endpoints

### `GET /healthz`

Liveness probe. No auth.

```json
{ "status": "ok", "service": "api", "uptime": 12.34 }
```

### `POST /v1/sessions`

Create an anonymous session. No auth.

```json
// 200
{ "sessionId": "clx…", "token": "eyJ…", "expiresAt": 1737000000 }
```

### `GET /v1/ice-servers`

STUN/TURN servers with freshly minted, short-lived TURN credentials. Requires a
session.

```json
// 200
{
  "iceServers": [
    { "urls": "stun:localhost:3478" },
    { "urls": "turn:localhost:3478", "username": "1737000000:clx…", "credential": "…" }
  ],
  "expiresAt": 1737000000
}
// 401 -> { "error": { "code": "unauthorized", "message": "Valid session required." } }
```

### `POST /v1/reports`

File a moderation report against the peer from a call. Requires a session.
The server verifies against its own `Call` record that the reporter was a
participant of the room and that `reportedPeerId` is the _other_ participant.

```json
// request body
{
  "roomId": "…",
  "reportedPeerId": "…",            // the peer's session id from `matched`
  "reason": "harassment",           // nudity | harassment | minor | spam | other
  "details": "optional free text"
}
// 200
{ "reportId": "clx…" }
// 401 unauthorized · 403 not a participant / wrong peer · 404 unknown call · 429 rate limited
```

### `GET /metrics`

Prometheus scrape endpoint (process defaults + request-duration histogram).
Hidden from the OpenAPI document; restrict it to internal networks in
production.

## Error shape

Handled errors use a consistent envelope (`ErrorResponseSchema`):

```json
{ "error": { "code": "not_found", "message": "Unknown call." } }
```

## Contracts

Request/response types are exported from
[`@cougny/protocol`](./packages/protocol.md) (`rest.ts`, `ice.ts`) and can be
imported by any TypeScript client for end-to-end type safety.
