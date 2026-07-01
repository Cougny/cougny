# Monorepo

Cougny is a [pnpm](https://pnpm.io) workspace orchestrated by
[Turborepo](https://turbo.build).

## Layout

```
apps/
  web/          @cougny/web         Next.js user client
  api/          @cougny/api         Fastify HTTP API
  signaling/    @cougny/signaling   WebSocket signaling + matchmaking
packages/
  protocol/          @cougny/protocol           Shared Zod contracts
  db/                @cougny/db                 Prisma schema + client
  config-typescript/ @cougny/config-typescript  Shared tsconfig presets
  config-eslint/     @cougny/config-eslint      Shared ESLint flat config
infra/          docker-compose + coturn config
docs/           this documentation
```

Workspace globs are declared in [`pnpm-workspace.yaml`](../pnpm-workspace.yaml).

## Internal packages

Apps depend on internal packages with the `workspace:*` protocol, e.g.:

```jsonc
"dependencies": {
  "@cougny/protocol": "workspace:*",
  "@cougny/db": "workspace:*"
}
```

`@cougny/protocol` and `@cougny/db` are compiled (they emit `dist/`); the
`config-*` packages are consumed directly.

## Turborepo

[`turbo.json`](../turbo.json) defines the task graph:

| Task                          | Notes                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `build`                       | `dependsOn: ["^build"]` — builds dependencies first. Caches `dist/**` and `.next/**`.                    |
| `dev`                         | `dependsOn: ["^build"]`, `persistent`, uncached — shared packages build before apps start in watch mode. |
| `lint` / `typecheck` / `test` | Run per package.                                                                                         |
| `clean`                       | Uncached.                                                                                                |

Run a task across everything from the root:

```bash
pnpm build        # turbo run build
pnpm dev          # turbo run dev
pnpm lint
pnpm typecheck
pnpm test
```

Filter to one package:

```bash
pnpm --filter @cougny/api dev
pnpm --filter @cougny/protocol build
```

## Why the shared `protocol` package matters

Because both the web client (`parseServerMessage`) and the signaling server
(`parseClientMessage`) import the **same** Zod schemas, a change to the wire
format is a single edit that both ends pick up — and a mismatch becomes a
compile error rather than a runtime bug.

## Adding a package

1. Create `packages/<name>/package.json` (name it `@cougny/<name>`).
2. Extend a shared tsconfig from
   [`@cougny/config-typescript`](./packages/config.md).
3. Add an `eslint.config.js` that re-exports `@cougny/config-eslint/base`.
4. Reference it from consumers with `"@cougny/<name>": "workspace:*"` and run
   `pnpm install`.
