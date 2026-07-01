# packages/protocol — `@cougny/protocol`

The **single source of truth** for every message and payload exchanged in
Cougny. Pure Zod schemas + inferred TypeScript types, consumed by the web
client, the signaling server, and the API.

## Why it exists

The web client and the signaling server parse the _same_ schemas. A change to
the wire format is one edit both ends pick up, and a mismatch is a compile
error — not a production incident.

## Modules

```
src/
  signaling.ts   WebSocket protocol (client/server message unions)
  ice.ts         ICE server / TURN credential response
  rest.ts        HTTP request/response contracts
  index.ts       Barrel export + PROTOCOL_VERSION
```

### `signaling.ts`

- `ClientMessageSchema` / `ServerMessageSchema` — discriminated unions keyed on
  `t` (see the tables in [webrtc.md](../webrtc.md#wire-protocol)).
- `SignalPayloadSchema` — `sdp` | `ice` discriminated union.
- `MatchPreferencesSchema` — optional `locale` / `interests`.
- `parseClientMessage` / `parseServerMessage` — safe parse helpers returning a
  typed `{ ok, message } | { ok: false, error }`.

### `ice.ts`

- `IceServerSchema`, `IceServersResponseSchema` — the shape returned by
  `GET /v1/ice-servers` and passed straight to `RTCPeerConnection`.

### `rest.ts`

- `HealthResponseSchema`, `CreateSessionResponseSchema`,
  `CreateReportRequestSchema`, `CreateReportResponseSchema`,
  `ErrorResponseSchema`.

## Usage

```ts
import { parseClientMessage, type ServerMessage } from '@cougny/protocol';

const result = parseClientMessage(JSON.parse(raw));
if (result.ok) handle(result.message); // fully typed & validated
```

The API also feeds these schemas directly into Fastify for validation and
OpenAPI generation — see [apps/api](../apps/api.md#validation--docs-from-one-source).

## Build

Compiled with `tsc` to `dist/` (ESM + declaration maps). Consumers depend on it
with `"@cougny/protocol": "workspace:*"`; Turborepo builds it before anything
that imports it.
