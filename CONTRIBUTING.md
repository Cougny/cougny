# Contributing to Cougny

Thanks for helping build Cougny. This guide covers the workflow and the
non-negotiable conventions; the architecture itself is documented in
[`docs/`](./docs/README.md).

## Getting set up

Prerequisites: Node 24 (`.nvmrc`), pnpm 10 (via `corepack enable`), Docker.

```bash
pnpm install

# Copy each app/package's env template to a local .env
for d in apps/api apps/signaling apps/web packages/db; do cp "$d/.env.example" "$d/.env"; done

pnpm infra:up        # Postgres, Redis, coturn
pnpm db:generate     # Prisma client
pnpm db:migrate      # apply migrations (prisma migrate dev)
pnpm dev             # web :3000, api :4000, signaling :4001
```

See [docs/getting-started.md](./docs/getting-started.md) for details and
[docs/development.md](./docs/development.md) for the day-to-day workflow.

## Branches and pull requests

- Branch from `main`; never commit to `main` directly.
- Keep PRs focused — one logical change per PR. Split refactors from behavior
  changes.
- Every PR must pass CI (lint, typecheck, tests, knip, migration validation,
  build) before review.
- Write commit messages in the imperative mood ("Add report rate limit", not
  "Added…"). No tool or vendor attributions of any kind — no
  `Co-Authored-By`/"Generated with" trailers (see
  [`CLAUDE.md`](./CLAUDE.md), rule 3).

## Before you push

CI runs all of these; save yourself a round trip:

```bash
pnpm lint            # ESLint (a pre-commit hook auto-fixes staged files)
pnpm typecheck
pnpm test
pnpm knip            # unused files, dependencies, exports
pnpm format:check    # Prettier
pnpm build
```

## Conventions (enforced in review)

1. **Wire contracts live in `@cougny/protocol`.** The web client, API, and
   signaling server all parse the same Zod schemas. Never define a message or
   payload shape anywhere else.

2. **Database changes ship as migrations — never `prisma db push`.** Edit
   `packages/db/prisma/schema.prisma`, then run `pnpm db:migrate` to generate a
   migration, and commit the new directory under
   `packages/db/prisma/migrations/`. Everything downstream — CI, Docker,
   production — applies schema changes exclusively via `prisma migrate deploy`.
   CI fails if migrations don't apply cleanly to a fresh database or if
   `schema.prisma` drifts from the committed migrations.

3. **No hardcoded user-facing English.** All copy lives in
   `apps/web/messages/*.json` and renders through `next-intl`. Locale-specific
   formatting (dates, numbers) must be localizable too.

4. **Latest stable majors only.** New and updated dependencies target the
   newest stable major release; do the migration rather than pinning old.
   No pre-release/beta versions. Dependabot keeps this honest.

5. **Keep docs and instruction files true.** If your change affects behavior
   described in `docs/`, update the doc in the same PR. `CLAUDE.md`,
   `AGENTS.md`, and `.github/copilot-instructions.md` are mirrors — any change
   to one must be applied identically to all three.

6. **New environment variables** must be added everywhere they matter: the
   app's Zod env schema, its `.env.example`, the compose files
   (`docker-compose.yml` / `docker-compose.prod.yml`), and the secrets table in
   [docs/deployment.md](./docs/deployment.md).

## Testing

- Unit tests live next to the code they cover (`*.test.ts`) and run with
  Vitest (`pnpm test`).
- Pure logic (matchmaking, protocol parsing, credential minting) must be
  unit-tested. Keep the logic pure and injectable so it stays testable without
  sockets or databases.

## Reporting security issues

Please do not open public issues for vulnerabilities — use GitHub's private
vulnerability reporting as described in [SECURITY.md](./SECURITY.md).

## Licensing

Cougny is licensed under the [GNU AGPL-3.0](./LICENSE). By contributing, you
agree that your contributions are licensed under the same terms.
