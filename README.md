# Cougny

[![CI](https://github.com/Cougny/cougny/actions/workflows/ci.yml/badge.svg)](https://github.com/Cougny/cougny/actions/workflows/ci.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](./LICENSE)

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

# Copy each app/package's env template to a local .env
for d in apps/api apps/signaling apps/web packages/db; do cp "$d/.env.example" "$d/.env"; done

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

## Deploying

The reference production deployment is a single-host Docker stack defined in
[`docker-compose.prod.yml`](./docker-compose.prod.yml): Caddy (automatic
Let's Encrypt TLS) in front of the three apps, plus Postgres, Redis, and
coturn, with every secret injected by [Doppler](https://www.doppler.com) —
no `.env` files on the server. The full walkthrough (DNS, firewall, TURN) is
in [docs/deployment.md](./docs/deployment.md), and it works on any Ubuntu box
with a public IP.

## Conventions

- **Contracts live in `@cougny/protocol`.** The web client and the signaling
  server parse the same Zod schemas — change the wire format in one place.
- **No hardcoded user-facing English.** All copy lives in
  `apps/web/messages/*.json` and is rendered via `next-intl`.
- See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the contribution workflow,
  and [`CLAUDE.md`](./CLAUDE.md) / [`AGENTS.md`](./AGENTS.md) for AI-assistant
  guidance.

## Security

Found a vulnerability? Please report it privately — see
[`SECURITY.md`](./SECURITY.md). Product-level safety and moderation design is
documented in
[docs/security-and-moderation.md](./docs/security-and-moderation.md).

## License

Copyright © 2026 Cemal Shabinas and Adnan Shajahan.

Cougny is free software, licensed under the
[GNU Affero General Public License v3.0](./LICENSE) (AGPL-3.0). If you run a
modified version as a network service, the AGPL requires you to offer its
source to your users.
