# Architecture

Cougny pairs two people for a live, peer-to-peer video chat. Our servers handle
matchmaking, signaling, and safety — **media never touches them**.

## System overview

```
                    ┌──────────────────────────────────────────┐
                    │                Browser (web)               │
                    │   Next.js · useRandomCall · RTCPeerConn.   │
                    └───┬───────────────┬───────────────┬────────┘
             HTTPS      │        WSS    │       WebRTC   │ (SRTP, P2P)
                        ▼               ▼               ▼
                 ┌────────────┐   ┌────────────┐   ┌──────────┐
                 │    api     │   │ signaling  │   │  coturn  │
                 │  Fastify   │   │    ws      │   │ TURN/STUN│
                 └─────┬──────┘   └─────┬──────┘   └──────────┘
                       │                │
                 ┌─────▼─────┐    (in-process
                 │ postgres  │     matchmaker;
                 └───────────┘     redis planned)
```

The other browser sits on the far side of the WebRTC arrow; once negotiated,
audio/video flows **directly between the two browsers** (relayed through coturn
only when a direct path is blocked by NAT/firewall).

## Components

| Component     | Responsibility                            | Tech                      |
| ------------- | ----------------------------------------- | ------------------------- |
| **web**       | UI, media capture, WebRTC peer connection | Next.js, React, next-intl |
| **api**       | Sessions, ICE/TURN credentials, reports   | Fastify, Prisma, JWT      |
| **signaling** | Matchmaking + SDP/ICE relay               | Node `ws`                 |
| **coturn**    | STUN/TURN for NAT traversal               | self-hosted               |
| **postgres**  | Accounts, sessions, calls, reports        | PostgreSQL                |
| **protocol**  | Shared, typed wire contracts              | Zod                       |

## The lifecycle of a call

0. **Account** — calling requires one. The browser signs in (email/password,
   Google, Discord, or a passkey) and holds a short-lived access token in
   memory, refreshed from an httpOnly cookie. See
   [api-reference.md](./api-reference.md#accounts).
1. **Session** — it calls `POST /v1/sessions` with that access token and stores
   the returned call-session JWT. The session is attached to the account, but
   only its random id is ever shown to a peer.
2. **ICE** — it calls `GET /v1/ice-servers` for STUN plus short-lived TURN
   credentials minted from coturn's shared secret.
3. **Queue** — it opens a WebSocket to the signaling server and sends
   `queue.join`.
4. **Match** — the signaling server pairs it with another waiting peer, creates
   a room, and tells each side its `polite` role (for perfect negotiation).
5. **Negotiate** — the two browsers exchange SDP offers/answers and ICE
   candidates _through_ the signaling relay.
6. **Connect** — the `RTCPeerConnection` establishes a direct media path. Video
   and audio now flow P2P.
7. **Next / leave** — either peer can `peer.leave` (skip) to tear down the room
   and rejoin the queue, or disconnect entirely.

Full detail: [webrtc.md](./webrtc.md).

## Design principles

- **Independent deployables.** Each app is its own process and Docker target, so
  the realtime path scales (and can be rewritten) independently of the web tier.
- **Custom over managed, where it's the big-app pattern and feasible.** We run
  our own signaling and self-host coturn instead of paying a per-minute video/
  TURN vendor. See [webrtc.md](./webrtc.md#why-custom).
- **One source of truth for contracts.** [`@cougny/protocol`](./packages/protocol.md)
  defines every message and payload as a Zod schema used by both ends.
- **Swappable seams.** The matchmaker is a pure, transport-free interface; a
  Redis-backed implementation slots in without touching the signaling hub.
