# WebRTC, Signaling & Matchmaking

This is the heart of Cougny: how two strangers' browsers find each other and
establish a direct video connection.

## Roles

- **Media** is peer-to-peer (WebRTC / SRTP). It flows browser ↔ browser.
- **Signaling** (the [`signaling`](./apps/signaling.md) server) only relays the
  SDP and ICE messages the two browsers need to negotiate. It never sees media.
- **STUN/TURN** ([coturn](./infrastructure.md#coturn)) helps browsers discover
  their public network path and, if a direct path is impossible, relays the
  encrypted media as a fallback.

## Wire protocol

Every signaling message is a Zod-validated discriminated union defined in
[`@cougny/protocol`](./packages/protocol.md) (`signaling.ts`).

**Client → server**

| `t`           | Payload                       | Meaning                             |
| ------------- | ----------------------------- | ----------------------------------- |
| `queue.join`  | `{ locale?, interests? }`     | Enter the matchmaking pool.         |
| `queue.leave` | —                             | Leave the pool.                     |
| `signal`      | `{ kind: 'sdp' \| 'ice', … }` | Forward SDP/ICE to the peer.        |
| `peer.leave`  | —                             | Skip / hang up on the current peer. |
| `heartbeat`   | —                             | Application-level keepalive.        |

**Server → client**

| `t`         | Payload                       | Meaning                                 |
| ----------- | ----------------------------- | --------------------------------------- |
| `queued`    | `{ position? }`               | Waiting for a match.                    |
| `matched`   | `{ roomId, peerId, polite }`  | Paired — begin negotiation.             |
| `signal`    | `{ kind: 'sdp' \| 'ice', … }` | A message from your peer.               |
| `peer.left` | `{ reason }`                  | Peer skipped/disconnected/was reported. |
| `error`     | `{ code, message }`           | Protocol or server error.               |
| `pong`      | —                             | Heartbeat reply.                        |

## Matchmaking

The [`Matchmaker`](../apps/signaling/src/matchmaker.ts) is a **pure, in-process,
FIFO** pool with a deliberately narrow interface:

```ts
enqueue(id, preferences): Match | null   // pairs immediately if possible
remove(id): void
positionOf(id): number
```

- First peer to join waits; the next compatible peer pairs with it instantly.
- Compatibility today: not self, and — if both declared `interests` — at least
  one shared interest. Everything else matches anyone.
- No transport concerns leak in, so it is trivially unit-tested
  ([`matchmaker.test.ts`](../apps/signaling/src/matchmaker.test.ts)) and can be
  replaced by a Redis/ZSET implementation for multi-instance scale **without
  changing the hub**.

The [`Hub`](../apps/signaling/src/hub.ts) owns connections, rooms, and routing;
it validates every inbound frame, pairs peers, assigns `polite` roles, and
relays `signal` messages to the correct peer.

## Perfect negotiation

Both peers add their local tracks, so both may try to send an offer at once
("glare"). Cougny uses the standard
[perfect negotiation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation)
pattern, implemented in
[`useRandomCall.ts`](../apps/web/src/hooks/useRandomCall.ts):

- The server marks exactly one peer **polite** (`matched.polite`).
- On an offer collision, the **polite** peer rolls back and accepts the incoming
  offer; the **impolite** peer ignores it and keeps its own.
- ICE candidates are trickled as they arrive; a `null` candidate marks
  end-of-candidates.

This lets either side (re)negotiate at any time without a fixed
caller/callee handshake.

## ICE & TURN credentials

Before creating the peer connection the client fetches
`GET /v1/ice-servers`, which returns STUN plus **ephemeral** TURN credentials.

Cougny mints them with coturn's REST-API scheme
([`turn.ts`](../apps/api/src/turn.ts)):

```
username   = "<unix-expiry>:<sessionId>"
credential = base64( HMAC-SHA1( TURN_STATIC_AUTH_SECRET, username ) )
```

coturn recomputes the same HMAC from its own copy of the secret, so:

- the raw secret never leaves our servers,
- each credential auto-expires (`TURN_CREDENTIAL_TTL`),
- there is no per-user TURN account to manage.

## <a id="why-custom"></a>Why custom over a managed API

For 1:1 random calling, running our own signaling server and self-hosting coturn
is both the established big-app pattern and dramatically cheaper: because media
is peer-to-peer, marginal cost per call is near zero (only TURN-relayed calls
consume our bandwidth). A managed video/TURN vendor would add per-minute cost
and reduce control over matchmaking and moderation for capabilities we don't
need at 1:1 scale.

The scale path stays open: a Redis-backed matchmaker for horizontal signaling,
and an SFU (e.g. mediasoup/LiveKit) if/when group rooms are added — both behind
the interfaces we already have.
