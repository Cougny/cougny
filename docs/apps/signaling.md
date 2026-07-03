# apps/signaling — `@cougny/signaling`

The realtime service: matchmaking and the SDP/ICE relay that lets two browsers
negotiate a peer-to-peer connection. **No media passes through it.**

## Stack

- Node **`ws`** WebSocket server on a bare `http` server
- **pino** logging, **prom-client** metrics
- **@cougny/protocol** for validated message contracts
- **jsonwebtoken** (session token verification) and **@cougny/db** (call records)

## Structure

```
src/
  index.ts        Entrypoint (start + graceful shutdown)
  server.ts       HTTP+WS server: /healthz, /metrics, handshake auth, heartbeat
  hub.ts          Hub: connections, rooms, routing, pairing
  matchmaker.ts   Matchmaker: pure FIFO pairing pool
  connection.ts   Connection: typed wrapper around one socket + rate buckets
  auth.ts         Session-token verification (shared AUTH_JWT_SECRET)
  calls.ts        Fire-and-forget Call start/end persistence
  rate-limit.ts   TokenBucket
  metrics.ts      Prometheus registry, counters, live gauges
  env.ts          Zod-validated environment
  logger.ts       pino logger
  matchmaker.test.ts
  rate-limit.test.ts
```

## How it works

- **`server.ts`** gates every upgrade at the handshake: the Origin must be on
  the allowlist **and** `?token=` must be a session JWT minted by the API
  (verified locally via the shared `AUTH_JWT_SECRET`). It serves `GET /healthz`
  for probes and `GET /metrics` for Prometheus, and runs a ping/pong
  **heartbeat** that terminates dead sockets so abandoned rooms don't leak.
- **`Hub`** ([`hub.ts`](../../apps/signaling/src/hub.ts)) registers each
  `Connection` (carrying its authenticated session id), validates every inbound
  frame with `parseClientMessage`, and dispatches: `queue.join` → matchmaker;
  `signal` → relay to peer; `peer.leave` / disconnect → tear down room and
  notify the peer. Frames are throttled by per-connection token buckets
  (a general one plus a stricter `queue.join` one); over-limit frames get the
  protocol's `rate_limited` error.
- **`Matchmaker`** ([`matchmaker.ts`](../../apps/signaling/src/matchmaker.ts)) is
  a pure FIFO pool — see [webrtc.md](../webrtc.md#matchmaking). It never pairs
  two connections of the same session (e.g. two tabs).
- On a match, the hub creates a room, **persists a `Call` row** (room id + both
  session ids — later used to validate reports), assigns exactly one peer the
  **`polite`** role, and sends each side a `matched` message carrying the
  peer's anonymous session id. When the room ends, the row gets `endedAt` and
  an end reason. Persistence is fire-and-forget: a database hiccup never blocks
  live signaling.

## Observability

`GET /metrics` exposes process defaults plus `cougny_signaling_connections`,
`cougny_signaling_queue_size`, `cougny_signaling_matches_total`,
`cougny_signaling_messages_total{type}`, `cougny_signaling_rate_limited_total`,
and `cougny_signaling_rejected_handshakes_total{reason}`.

## Message contract

Client and server messages are the Zod unions in
[`@cougny/protocol`](../packages/protocol.md) — the same schemas the web client
uses. Anything that fails validation gets an `error` frame, never a crash.

## Scale path

The matchmaker's transport-free interface (`enqueue`/`remove`/`positionOf`) is
designed to be swapped for a Redis-backed pool for multi-instance signaling
without changing the hub. See [roadmap.md](../roadmap.md).

## Scripts

```bash
pnpm --filter @cougny/signaling dev     # tsx watch, :4001
pnpm --filter @cougny/signaling build
pnpm --filter @cougny/signaling test
```
