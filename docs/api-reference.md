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

Two kinds of bearer token, both sent the same way:

```
Authorization: Bearer <token>
```

- **Account access token** — returned by the `/v1/auth/*` sign-in routes. Short
  lived (15 minutes by default) and refreshed from an httpOnly cookie. Required
  by every account route and by `POST /v1/sessions`.
- **Call session token** — returned by `POST /v1/sessions`. Carries only a
  session id, expires after 7 days, and authorizes the signaling socket,
  `/v1/ice-servers`, and `/v1/reports`.

The two are signed with keys derived for different purposes, so one can never be
presented in place of the other.

### Refresh cookie

`cougny.refresh` is httpOnly, `Secure` in production, and scoped to `/v1/auth`.
It is never readable by client script. Every use rotates it: presenting a
refresh token revokes it and issues a successor. A token presented twice means a
copy exists, so the whole rotation family is revoked and the user must sign in
again.

Because it is a cookie, browser clients must send `credentials: 'include'` on
every `/v1/auth` request.

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

Create a call session. **Requires an account access token.** Calls are
face-to-face with a stranger, so every participant must resolve to an account
carrying an 18+ attestation; the check is enforced here, not only in the UI.

The session id is the only identity a peer ever sees — the account behind it is
never exposed on the wire.

```json
// 200
{ "sessionId": "clx…", "token": "eyJ…", "expiresAt": 1737000000 }
// 401 no account · 403 profile_incomplete (social sign-up not finished) · 429 rate limited
```

## Accounts

Every account route lives under `/v1/auth`, so the refresh cookie can be scoped
to that one path. Full request and response schemas are in the
[Swagger UI](http://localhost:4000/docs); the table below is the map.

| Route                                  | Auth    | Purpose                                                                                                |
| -------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| `GET /v1/auth/capabilities`            | —       | Which social providers and mail delivery this deployment has configured                                |
| `POST /v1/auth/register`               | —       | Email + password sign-up. Requires date of birth (18+), a UN-recognized country, and both attestations |
| `POST /v1/auth/login`                  | —       | Email + password sign-in                                                                               |
| `POST /v1/auth/refresh`                | cookie  | Exchange the refresh cookie for a new access token                                                     |
| `POST /v1/auth/logout`                 | cookie  | End this device's session                                                                              |
| `GET /v1/auth/me`                      | account | The signed-in profile                                                                                  |
| `PATCH /v1/auth/me`                    | account | Update display name / country                                                                          |
| `DELETE /v1/auth/me`                   | account | Delete the account (password required if one is set)                                                   |
| `POST /v1/auth/complete-profile`       | account | Supply what a social provider could not: handle, date of birth, country, attestations                  |
| `POST /v1/auth/password/change`        | account | Change or set a password; signs out every other device                                                 |
| `POST /v1/auth/password/forgot`        | —       | Request a reset link. Always `200`, so it cannot be used to test whether an address is registered      |
| `POST /v1/auth/password/reset`         | —       | Redeem a reset link; revokes every session                                                             |
| `POST /v1/auth/email/verify`           | —       | Redeem a verification link                                                                             |
| `POST /v1/auth/email/resend`           | account | Send the verification email again                                                                      |
| `GET /v1/auth/sessions`                | account | List signed-in devices                                                                                 |
| `DELETE /v1/auth/sessions/:id`         | account | Sign out one device                                                                                    |
| `POST /v1/auth/sessions/revoke-others` | account | Sign out everywhere else                                                                               |

### Social sign-in

| Route                                   | Auth                         | Purpose                                                        |
| --------------------------------------- | ---------------------------- | -------------------------------------------------------------- |
| `GET /v1/auth/oauth/:provider/start`    | — (account for `?mode=link`) | Returns the provider authorization URL                         |
| `GET /v1/auth/oauth/:provider/callback` | —                            | Provider redirect target; always redirects back to the web app |
| `DELETE /v1/auth/oauth/:provider`       | account                      | Unlink an identity                                             |

`:provider` is `google` or `discord`, and each is offered only once its
credentials are configured. The flow uses authorization code + PKCE with a
signed, short-lived state cookie. Identities are keyed on the provider's
immutable subject id, never on the email it reports.

A social sign-up creates an account that is deliberately **incomplete** — no
provider can vouch for an age or a country. Its holder is routed to
`POST /v1/auth/complete-profile`, and until that succeeds the account cannot
create a call session.

### Passkeys

| Route                                         | Auth    | Purpose                  |
| --------------------------------------------- | ------- | ------------------------ |
| `POST /v1/auth/passkeys/register/options`     | account | Begin enrollment         |
| `POST /v1/auth/passkeys/register`             | account | Finish enrollment        |
| `POST /v1/auth/passkeys/authenticate/options` | —       | Begin a passkey sign-in  |
| `POST /v1/auth/passkeys/authenticate`         | —       | Finish a passkey sign-in |
| `GET /v1/auth/passkeys`                       | account | List registered passkeys |
| `PATCH /v1/auth/passkeys/:id`                 | account | Rename                   |
| `DELETE /v1/auth/passkeys/:id`                | account | Remove                   |

The WebAuthn challenge is held in a signed, short-lived cookie rather than a
table. Passkeys are an additional way into an existing account, not a way to
create one — an account still needs the age and country a ceremony cannot
supply. Neither unlinking a social identity nor removing a passkey is allowed to
leave an account with no way to sign in.

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

Every error — including request-validation failures and unhandled exceptions —
uses one envelope (`ErrorResponseSchema`), applied by a global error handler:

```json
{ "error": { "code": "not_found", "message": "Unknown call." } }
```

Validation failures are `400` with code `invalid_request`. A `500` is always
`{ "code": "internal_error", "message": "Something went wrong." }` — the details
go to the log, never to the caller.

## Contracts

Request/response types are exported from
[`@cougny/protocol`](./packages/protocol.md) (`rest.ts`, `ice.ts`, `auth.ts`,
`countries.ts`) and can be imported by any TypeScript client for end-to-end type
safety. The age check and the UN country list live there too, so the browser and
the server apply exactly the same rules.
