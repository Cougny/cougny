# Security, Safety & Moderation

Random video chat with strangers has a serious safety surface. This documents
what exists today and what is deliberately still open.

> Found an exploitable vulnerability? Report it privately — see
> [SECURITY.md](../SECURITY.md). This page covers product safety design, not
> disclosure.

## Identity & privacy

- **Anonymous by design.** No accounts, emails, or profiles. A session is a
  random id in a signed JWT ([`tokens.ts`](../apps/api/src/tokens.ts)).
- **Minimal metadata.** We store a **hashed** IP (`sha256`, never raw), user
  agent, and coarse locale on a session — for abuse mitigation only, never shown
  to peers. See [the schema](./packages/db.md).
- **Media is peer-to-peer and never recorded.** Only call _metadata_ (who was
  paired, when, why it ended) is persisted.

## Transport security

- **Origin allowlist.** Both the API (CORS) and the signaling server
  (`verifyClient`) reject browser origins outside `SIGNALING_ALLOWED_ORIGINS`.
- **Bearer auth.** ICE credentials and reports require a valid session token, so
  TURN credentials aren't handed to anonymous scrapers. The **signaling socket
  requires the same token at the handshake** (`/v1?token=`), verified against the
  shared `AUTH_JWT_SECRET` — unauthenticated upgrades are rejected before a
  connection exists.
- **Rate limiting.** The API throttles per IP globally, with tighter per-route
  limits on session creation (per IP) and reports (per session). The signaling
  server enforces a per-connection token bucket on inbound frames plus a
  dedicated throttle on `queue.join` re-queues, answering with the protocol's
  `rate_limited` error code.
- **Ephemeral TURN credentials.** Time-boxed HMAC credentials; the shared secret
  never reaches the browser. See
  [webrtc.md](./webrtc.md#ice--turn-credentials).
- **Schema validation everywhere.** Every signaling frame and API body is parsed
  with Zod before use; malformed input is rejected, not coerced.
- **Production TLS.** Terminate `wss://` and `https://`, and enable coturn
  TLS/DTLS (`5349`) — see [infrastructure.md](./infrastructure.md#coturn).

## Moderation (today)

- **Reporting.** A peer can be reported in-call (flag button → reason dialog)
  via `POST /v1/reports` with a reason (`nudity`, `harassment`, `minor`,
  `spam`, `other`). Reports are linked to the `Call` and both sessions and
  stored with status `OPEN`.
- **Participants are verified server-side.** The signaling hub records every
  match as a `Call` row; the API only accepts a report if the reporter's
  session was in that room and the reported id is the _other_ participant
  (`403` otherwise). A report can never name an arbitrary session.
- **Skip / leave.** `peer.leave` immediately tears down the room and notifies
  the other side. Disconnects are detected via the socket heartbeat.

## Known gaps (open work)

These are intentionally **not** built yet; track them in
[roadmap.md](./roadmap.md):

- **No automated content moderation** (e.g. nudity detection on the client
  before publish).
- **No moderator tooling** to review the `Report` queue or ban abusive sessions.
- **No age assurance** beyond the guidelines notice.
- **Rate limits are per instance for signaling** (and for the API unless
  `REDIS_URL` is set) — horizontal scale-out needs the shared Redis backing.

> If you extend Cougny toward production, treat the items above as launch
> blockers for a public deployment, not nice-to-haves.
