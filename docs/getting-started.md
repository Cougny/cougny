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
cp .env.example .env
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

All configuration is documented inline in [`.env.example`](../.env.example).
Highlights:

| Variable                    | Used by        | Purpose                             |
| --------------------------- | -------------- | ----------------------------------- |
| `DATABASE_URL`              | api, db        | Postgres connection string.         |
| `AUTH_JWT_SECRET`           | api            | Signs anonymous session tokens.     |
| `TURN_STATIC_AUTH_SECRET`   | api, coturn    | Shared secret for TURN credentials. |
| `SIGNALING_ALLOWED_ORIGINS` | api, signaling | Browser origin allowlist.           |
| `NEXT_PUBLIC_API_URL`       | web            | Where the browser reaches the API.  |
| `NEXT_PUBLIC_SIGNALING_URL` | web            | Where the browser opens the socket. |

## Troubleshooting

- **`Cannot find module '@cougny/protocol'`** — run `pnpm build` once so shared
  packages emit their `dist/`. `pnpm dev` also builds them first.
- **Prisma type errors** — run `pnpm db:generate` after changing the schema.
- **TURN not connecting** — confirm `coturn` is up (`docker compose ps`) and
  that `TURN_STATIC_AUTH_SECRET` matches in both `.env` and the container.
