# Cougny

Random 1:1 video calling — meet someone new, face to face.

Cougny pairs two people at a time for a live, peer-to-peer video chat. Media
flows directly between browsers over WebRTC; our servers only handle
matchmaking, signaling, and safety.

## Architecture

This is a [pnpm](https://pnpm.io) + [Turborepo](https://turbo.build) monorepo.
Apps are deliberately separate deployables so each can scale (and later be
rewritten) independently.

```
apps/
  web/         Next.js (App Router, TypeScript, Tailwind, next-intl) — user client
  api/         Fastify HTTP API — anonymous sessions, TURN credentials, reports
  signaling/   WebSocket signaling + FIFO matchmaking (ws)
packages/
  protocol/          Zod-typed signaling + REST contracts (shared source of truth)
  db/                Prisma schema + client (PostgreSQL)
  config-typescript/ Shared tsconfig presets
  config-eslint/     Shared ESLint flat config
infra/         docker-compose: PostgreSQL, Redis, coturn (self-hosted TURN/STUN)
```

### How a call is established

1. The web client creates an anonymous **session** (`POST /v1/sessions`) and
   stores the returned token.
2. It fetches **ICE servers** (`GET /v1/ice-servers`) — STUN plus short-lived
   TURN credentials minted by the API from coturn's shared secret.
3. It opens a **signaling** socket and joins the queue. The signaling server
   pairs it with another waiting peer and assigns perfect-negotiation roles.
4. The two browsers exchange SDP/ICE through the signaling relay and then talk
   **directly, peer-to-peer**. No media touches our servers.

### Why custom over managed APIs

For 1:1 random calling, running our own signaling server and self-hosting
**coturn** (rather than paying a per-minute TURN/video vendor) is both the
big-app pattern and dramatically cheaper at scale. The matchmaker and signaling
hub are small, pure, and unit-tested, and the TURN credential scheme is the
standard coturn REST-API HMAC pattern. The scale path — a Redis-backed queue
and an SFU for group calls — slots in behind the same interfaces.

## Getting started

Prerequisites: Node 24 (`.nvmrc`), pnpm 10, Docker.

```bash
pnpm install
cp .env.example .env

# Start Postgres, Redis, and coturn
pnpm infra:up

# Generate the Prisma client and apply the schema
pnpm db:generate
pnpm db:migrate

# Run every app in watch mode (web :3000, api :4000, signaling :4001)
pnpm dev
```

Open http://localhost:3000.

## Common tasks

| Command              | What it does                      |
| -------------------- | --------------------------------- |
| `pnpm dev`           | Run all apps in watch mode        |
| `pnpm build`         | Build everything (topologically)  |
| `pnpm lint`          | Lint all packages                 |
| `pnpm typecheck`     | Type-check all packages           |
| `pnpm test`          | Run unit tests                    |
| `pnpm knip`          | Find unused files/deps/exports    |
| `pnpm infra:up/down` | Start / stop local infrastructure |
| `pnpm db:studio`     | Open Prisma Studio                |

## Conventions

- **Contracts live in `@cougny/protocol`.** The web client and the signaling
  server parse the same Zod schemas — change the wire format in one place.
- **No hardcoded user-facing English.** All copy lives in
  `apps/web/messages/*.json` and is rendered via `next-intl`.
- See [`CLAUDE.md`](./CLAUDE.md) / [`AGENTS.md`](./AGENTS.md) for contributor
  guidance.
