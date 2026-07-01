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

File a moderation report against a peer. Requires a session.

```json
// request body
{
  "roomId": "…",
  "reportedPeerId": "…",
  "reason": "harassment",           // nudity | harassment | minor | spam | other
  "details": "optional free text"
}
// 200
{ "reportId": "clx…" }
// 401 unauthorized · 404 unknown call
```

## Error shape

Handled errors use a consistent envelope (`ErrorResponseSchema`):

```json
{ "error": { "code": "not_found", "message": "Unknown call." } }
```

## Contracts

Request/response types are exported from
[`@cougny/protocol`](./packages/protocol.md) (`rest.ts`, `ice.ts`) and can be
imported by any TypeScript client for end-to-end type safety.
