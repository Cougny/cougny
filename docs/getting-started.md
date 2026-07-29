# Getting Started

## Prerequisites

| Tool    | Version                        | Notes                                  |
| ------- | ------------------------------ | -------------------------------------- |
| Node.js | 24 (see [`.nvmrc`](../.nvmrc)) | `nvm use` picks it up.                 |
| pnpm    | 10+                            | `corepack enable` or install manually. |
| Docker  | recent                         | For Postgres, Redis, and coturn.       |

## Install

```bash
pnpm install

# Copy each app/package's env template to a local .env
for d in apps/api apps/signaling apps/web packages/db; do cp "$d/.env.example" "$d/.env"; done
```

`pnpm install` also sets up the Husky git hooks via the `prepare` script.

## Start infrastructure

```bash
pnpm infra:up      # postgres :5432, redis :6379, coturn :3478
```

Apply the database schema and generate the Prisma client:

```bash
pnpm db:generate
pnpm db:migrate
```

## Run the apps

```bash
pnpm dev
```

This runs all three apps in watch mode:

| App       | URL                                     |
| --------- | --------------------------------------- |
| web       | http://localhost:3000                   |
| api       | http://localhost:4000 (docs at `/docs`) |
| signaling | ws://localhost:4001                     |

Open http://localhost:3000 in **two** browser tabs (or two devices on the same
network) to match yourself and start a call.

## Environment variables

Each app and the `db` package has its own `.env.example` documenting its
variables inline ([api](../apps/api/.env.example),
[signaling](../apps/signaling/.env.example), [web](../apps/web/.env.example),
[db](../packages/db/.env.example)). Highlights:

| Variable                    | Used by        | Purpose                             |
| --------------------------- | -------------- | ----------------------------------- |
| `DATABASE_URL`              | api, db        | Postgres connection string.         |
| `AUTH_JWT_SECRET`           | api            | Root secret for all signed tokens.  |
| `TURN_STATIC_AUTH_SECRET`   | api, coturn    | Shared secret for TURN credentials. |
| `SIGNALING_ALLOWED_ORIGINS` | api, signaling | Browser origin allowlist.           |
| `NEXT_PUBLIC_API_URL`       | web            | Where the browser reaches the API.  |
| `NEXT_PUBLIC_SIGNALING_URL` | web            | Where the browser opens the socket. |

### Doppler (optional)

`.env` files are the default and need no account: copy the examples, fill them
in, done. If you have access to the Doppler workplace, the `cougny` project's
`dev` config already holds every local value, and there are two ways to use it.

```bash
doppler login
doppler setup --project cougny --config dev   # scopes this directory
```

**`pnpm env:pull` — write the values into `.env` (recommended).** Regenerates
all four `.env` files from Doppler, then everything works exactly as it always
has: `pnpm dev`, `pnpm db:migrate`, `pnpm docker:up`, no prefixes to remember.
Re-run it whenever a value changes in Doppler.

```bash
pnpm env:pull
```

**`pnpm dev:doppler` — inject without touching disk.** `pnpm dev` with the
secrets passed in as environment variables. Prefix any other command the same
way:

```bash
doppler run -- pnpm db:migrate
```

Injected values win over `.env`, because every app loads its file with `dotenv`,
which leaves variables already present in the environment alone. The two modes
therefore compose freely — nothing breaks if you use both.

Note that `dev:doppler` cannot cover everything. `docker-compose.yml` points at
`.env` files with `env_file:`, which Compose reads off disk; an injected
environment does not satisfy it. That is why `env:pull` is the recommended
route, and why the `.env` files should not be deleted.

#### How `env:pull` decides what goes where

Doppler holds the values; each `.env.example` decides which of them its app is
allowed to see. So `apps/web/.env` comes out with just the two `NEXT_PUBLIC_`
URLs and no secrets, while `apps/api/.env` gets the full set. Declaring a new
variable in the relevant `.env.example` is what makes `env:pull` start writing
it. Keys absent from Doppler are reported and skipped, which is normal for the
optional ones (`REDIS_URL`, `AUTH_COOKIE_DOMAIN`).

The generated files are written `0600` and stay gitignored. They are a build
artifact of the Doppler config, not a second source of truth — edit Doppler and
re-run, rather than editing them by hand.

#### Dev is not a copy of prod

The `dev` config is deliberately **not** a clone of `prd`. Its signing secrets
are generated separately, so a token minted locally cannot be replayed against
production, and it omits the keys that only mean something to the deployed
stack (`ACME_EMAIL`, `*_DOMAIN`, `POSTGRES_PASSWORD`). If you ever rebuild the
dev config, keep that property.

## Troubleshooting

- **`Cannot find module '@cougny/protocol'`** — run `pnpm build` once so shared
  packages emit their `dist/`. `pnpm dev` also builds them first.
- **Prisma type errors** — run `pnpm db:generate` after changing the schema.
- **TURN not connecting** — confirm `coturn` is up (`docker compose ps`) and
  that `TURN_STATIC_AUTH_SECRET` matches in both `.env` and the container.
