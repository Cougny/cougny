# Security, Safety & Moderation

Random video chat with strangers has a serious safety surface. This documents
what exists today and what is deliberately still open.

> Found an exploitable vulnerability? Report it privately — see
> [SECURITY.md](../SECURITY.md). This page covers product safety design, not
> disclosure.

## Identity & privacy

- **An account is required to call; peers stay pseudonymous to each other.**
  Calling needs a signed-in account, because a stranger-to-stranger video call
  should be traceable to something durable if it is reported. What a peer
  actually sees is only a random call-session id — never an email, a handle, or
  the account behind it.
- **18+ is attested and enforced server-side.** Sign-up records a date of birth
  and checks it against the shared
  [`isAtLeastMinimumAge`](../packages/protocol/src/auth.ts) helper, which both
  the form and every write route call — so the rule can never hold in one place
  and not the other. `POST /v1/sessions` refuses an account whose profile is
  incomplete, so a social sign-up cannot route around the check.
  This is attestation, not assurance; see the gaps below.
- **Agreements are recorded against an account, not a browser.** Acceptance of
  the terms and of the content rules (no CSAM, exploitation, or illegal
  material) are separate, timestamped columns on `User`. This replaced a consent
  splash backed by `localStorage`, which anyone could clear and which said
  nothing about _who_ had agreed.
- **Credentials are never stored in a usable form.** Passwords are Argon2id
  digests; refresh and emailed tokens are stored as SHA-256 verifiers; passkeys
  contribute only a public key.
- **Minimal metadata.** We store a **hashed** IP (`sha256`, never raw), user
  agent, and coarse locale on a session — for abuse mitigation only, never shown
  to peers. See [the schema](./packages/db.md).
- **Media is peer-to-peer and never recorded.** Only call _metadata_ (who was
  paired, when, why it ended) is persisted.

## Transport security

- **Origin allowlist.** Both the API (CORS) and the signaling server
  (`verifyClient`) reject browser origins outside `SIGNALING_ALLOWED_ORIGINS`.
- **Bearer auth.** ICE credentials and reports require a valid session token, so
  TURN credentials aren't handed to unauthenticated scrapers. The **signaling socket
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
- **Refresh tokens rotate, and replays are detected.** The refresh token lives
  in an httpOnly cookie scoped to `/v1/auth`, so page script cannot read it, and
  it is single-use. Presenting a spent token means a copy exists, so the whole
  rotation family is revoked. Access tokens are short-lived and re-check their
  backing session on every request, so revocation is immediate.
- **Token domain separation.** Account and call-session tokens are signed with
  keys derived per purpose from `AUTH_JWT_SECRET`, so one can never be presented
  in place of the other.
- **Sign-in cannot be used to enumerate accounts.** Wrong password, unknown
  address, and password-less account all return the same reply after the same
  work (an unregistered address is still verified against a decoy hash), and
  password reset always answers `200`.
- **Uniform error envelope.** A global handler maps every failure — including
  unhandled exceptions — to `{ error: { code, message } }`; `500`s report
  nothing beyond "something went wrong", with the detail going to the log.
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
- **No moderator tooling** to review the `Report` queue or ban accounts — though
  `User.status`, `UserRole`, and the `AuthAuditLog` trail are in place for it.
- **No age assurance.** Date of birth is self-declared: it is enforced
  consistently, and it is recorded against an identity, but nothing verifies it.
  Document- or estimation-based verification is still open.
- **No second factor beyond passkeys.** A passkey can be the only sign-in
  method, but there is no TOTP/step-up for password accounts.
- **Rate limits are per instance for signaling** (and for the API unless
  `REDIS_URL` is set) — horizontal scale-out needs the shared Redis backing.

> If you extend Cougny toward production, treat the items above as launch
> blockers for a public deployment, not nice-to-haves.
