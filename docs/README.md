# Cougny Documentation

Everything you need to understand, run, and extend Cougny — a platform for
random 1:1 video calls with strangers.

## Start here

- [Getting Started](./getting-started.md) — prerequisites, install, run locally.
- [Architecture](./architecture.md) — the big picture and how a call happens.

## Deep dives

| Topic                               | Doc                                                        |
| ----------------------------------- | ---------------------------------------------------------- |
| Monorepo tooling (pnpm + Turborepo) | [monorepo.md](./monorepo.md)                               |
| WebRTC signaling, matchmaking, TURN | [webrtc.md](./webrtc.md)                                   |
| Local & production infrastructure   | [infrastructure.md](./infrastructure.md)                   |
| HTTP API reference (+ Swagger UI)   | [api-reference.md](./api-reference.md)                     |
| Database schema                     | [packages/db.md](./packages/db.md)                         |
| Development workflow & code quality | [development.md](./development.md)                         |
| Security, safety & moderation       | [security-and-moderation.md](./security-and-moderation.md) |
| Roadmap & deferred work             | [roadmap.md](./roadmap.md)                                 |

## Per-project docs

**Apps**

- [apps/web](./apps/web.md) — Next.js user client.
- [apps/api](./apps/api.md) — Fastify HTTP API.
- [apps/signaling](./apps/signaling.md) — WebSocket signaling + matchmaking.

**Packages**

- [packages/protocol](./packages/protocol.md) — shared Zod contracts.
- [packages/db](./packages/db.md) — Prisma schema + client.
- [packages/config](./packages/config.md) — shared TypeScript & ESLint config.

## Conventions

- **Contracts are defined once**, in [`@cougny/protocol`](./packages/protocol.md),
  and consumed by every other package. The wire format has a single source of
  truth.
- **No hardcoded user-facing English.** All copy lives in
  `apps/web/messages/*.json` and renders through `next-intl`.
- **Nothing is committed automatically.** See [development.md](./development.md).

> Contributor rules live in [`CLAUDE.md`](../CLAUDE.md) / [`AGENTS.md`](../AGENTS.md)
> / [`.github/copilot-instructions.md`](../.github/copilot-instructions.md).
> These three files are mirrors and must stay identical.
