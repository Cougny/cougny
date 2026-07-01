# apps/signaling — `@cougny/signaling`

The realtime service: matchmaking and the SDP/ICE relay that lets two browsers
negotiate a peer-to-peer connection. **No media passes through it.**

## Stack

- Node **`ws`** WebSocket server on a bare `http` server
- **pino** logging
- **@cougny/protocol** for validated message contracts

## Structure

```
src/
  index.ts        Entrypoint (start + graceful shutdown)
  server.ts       HTTP+WS server: /healthz, origin check, heartbeat
  hub.ts          Hub: connections, rooms, routing, pairing
  matchmaker.ts   Matchmaker: pure FIFO pairing pool
  connection.ts   Connection: typed wrapper around one socket
  env.ts          Zod-validated environment
  logger.ts       pino logger
  matchmaker.test.ts
```

## How it works

- **`server.ts`** accepts sockets (rejecting disallowed origins via
  `verifyClient`), serves `GET /healthz` for probes, and runs a ping/pong
  **heartbeat** that terminates dead sockets so abandoned rooms don't leak.
- **`Hub`** ([`hub.ts`](../../apps/signaling/src/hub.ts)) registers each
  `Connection`, validates every inbound frame with `parseClientMessage`, and
  dispatches: `queue.join` → matchmaker; `signal` → relay to peer; `peer.leave`
  / disconnect → tear down room and notify the peer.
- **`Matchmaker`** ([`matchmaker.ts`](../../apps/signaling/src/matchmaker.ts)) is
  a pure FIFO pool — see [webrtc.md](../webrtc.md#matchmaking).
- On a match, the hub creates a room, assigns exactly one peer the **`polite`**
  role, and sends each side a `matched` message.

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
