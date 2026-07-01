# Security, Safety & Moderation

Random video chat with strangers has a serious safety surface. This documents
what exists today and what is deliberately still open.

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
  TURN credentials aren't handed to anonymous scrapers.
- **Ephemeral TURN credentials.** Time-boxed HMAC credentials; the shared secret
  never reaches the browser. See
  [webrtc.md](./webrtc.md#ice--turn-credentials).
- **Schema validation everywhere.** Every signaling frame and API body is parsed
  with Zod before use; malformed input is rejected, not coerced.
- **Production TLS.** Terminate `wss://` and `https://`, and enable coturn
  TLS/DTLS (`5349`) — see [infrastructure.md](./infrastructure.md#coturn).

## Moderation (today)

- **Reporting.** A peer can be reported via `POST /v1/reports` with a reason
  (`nudity`, `harassment`, `minor`, `spam`, `other`). Reports are linked to the
  `Call` and both sessions and stored with status `OPEN`.
- **Skip / leave.** `peer.leave` immediately tears down the room and notifies
  the other side. Disconnects are detected via the socket heartbeat.

## Known gaps (open work)

These are intentionally **not** built yet; track them in
[roadmap.md](./roadmap.md):

- **No rate limiting / abuse throttling.** Redis is provisioned for this.
- **No automated content moderation** (e.g. nudity detection on the client
  before publish).
- **No moderator tooling** to review the `Report` queue or ban abusive sessions.
- **No age assurance** beyond the guidelines notice.
- **Reporter/reported ids are trusted from the client** in the report payload;
  these should be cross-checked against the server's record of the room's
  participants before actioning.

> If you extend Cougny toward production, treat the items above as launch
> blockers for a public deployment, not nice-to-haves.
