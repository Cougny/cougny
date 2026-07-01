# Development Workflow

## Scripts

Run from the repo root (Turborepo fans them out across packages):

| Command                                         | What it does                           |
| ----------------------------------------------- | -------------------------------------- |
| `pnpm dev`                                      | Run all apps in watch mode.            |
| `pnpm build`                                    | Build every package/app (topological). |
| `pnpm lint`                                     | ESLint across all packages.            |
| `pnpm typecheck`                                | `tsc --noEmit` across all packages.    |
| `pnpm test`                                     | Unit tests (Vitest).                   |
| `pnpm knip`                                     | Find unused files, deps, and exports.  |
| `pnpm format` / `format:check`                  | Prettier write / check.                |
| `pnpm db:generate` / `db:migrate` / `db:studio` | Prisma tasks.                          |
| `pnpm infra:up` / `infra:down`                  | Local Docker infrastructure.           |

Per-package: `pnpm --filter @cougny/<name> <script>`.

## Code quality gates

### Pre-commit (Husky + lint-staged)

Installed automatically by the `prepare` script on `pnpm install`. On every
commit, [`.husky/pre-commit`](../.husky/pre-commit) runs `lint-staged`, which
only touches **staged** files:

| Staged path                                                            | Actions                                                         |
| ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| `apps/api/**/*.ts`, `apps/signaling/**/*.ts`, `packages/*/src/**/*.ts` | `eslint --fix` → `prettier --write`                             |
| `apps/web/**/*.{ts,tsx}`                                               | `prettier --write` (web is linted by its own flat config in CI) |
| `**/*.{js,cjs,mjs,jsx,json,md,yml,yaml,css}`                           | `prettier --write`                                              |

The config lives under `lint-staged` in the root
[`package.json`](../package.json).

> **How ESLint resolves config here:** flat config is resolved from the current
> working directory, so `lint-staged` (run from the repo root) uses the root
> [`eslint.config.js`](../eslint.config.js). It mirrors the shared base that
> each package uses, so results are identical. The web app is excluded from the
> eslint step and ignored by the root config.

To bypass the hook in an emergency: `git commit --no-verify` (avoid it).

### Continuous integration

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every push to
`main` and every PR: install → `db:generate` → `lint` → `typecheck` → `test` →
`knip` → `build`. Turborepo caching keeps it fast.

### Unused code & dependencies (knip)

[`knip`](https://knip.dev) (config: [`knip.json`](../knip.json)) reports unused
files, dependencies, and exports across the workspace. Run `pnpm knip` locally;
it also runs in CI. Keep it green — if it flags something, delete the dead code
or, for a genuinely-needed-but-indirect dependency, add it to
`ignoreDependencies` with a reason.

### Dependency updates (Dependabot)

[`.github/dependabot.yml`](../.github/dependabot.yml) opens weekly PRs for npm
dependencies (root + every app/package) and GitHub Actions. Minor/patch updates
are grouped to reduce noise; production and dev dependencies are separated.

## Testing

Unit tests use [Vitest](https://vitest.dev) and live next to the code they cover
(`*.test.ts`):

- [`matchmaker.test.ts`](../apps/signaling/src/matchmaker.test.ts) — pairing
  logic and edge cases.
- [`turn.test.ts`](../apps/api/src/turn.test.ts) — TURN HMAC credential
  generation.

```bash
pnpm test                              # everything
pnpm --filter @cougny/signaling test   # one package
```

The pure, transport-free design of the matchmaker and TURN minting is what makes
them cheap to test without spinning up servers.

## Conventions

- **TypeScript, strict.** Shared `tsconfig` presets live in
  [`@cougny/config-typescript`](./packages/config.md).
- **Contracts in `@cougny/protocol`.** Don't hand-write a duplicate type for a
  message or endpoint — import it.
- **No hardcoded user-facing English** — see [apps/web](./apps/web.md#i18n).
- **Never commit for the user, never self-advertise** — see
  [`CLAUDE.md`](../CLAUDE.md).
