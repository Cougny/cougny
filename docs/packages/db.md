# packages/db — `@cougny/db`

Prisma schema and a shared PrismaClient for PostgreSQL.

## Layout

```
prisma/schema.prisma   Models + enums (no connection URL — see below)
prisma.config.ts       Prisma 7 config: schema path, migrations, datasource URL
src/index.ts           Singleton `prisma` client (driver adapter) + re-exports @prisma/client
```

## Client (Prisma 7 + driver adapter)

Prisma 7 no longer reads a `url` from `schema.prisma`. Instead:

- **Migrations/introspection** get the URL from
  [`prisma.config.ts`](../../packages/db/prisma.config.ts) (which loads
  `DATABASE_URL` from the root `.env`).
- **Runtime** connects through a **driver adapter** — here
  [`@prisma/adapter-pg`](https://www.npmjs.com/package/@prisma/adapter-pg)
  (node-postgres, which the adapter bundles, so `pg` isn't a direct dependency).

[`src/index.ts`](../../packages/db/src/index.ts) constructs the adapter from
`DATABASE_URL` and exports one `PrismaClient`, cached on `globalThis` in
development so hot-reloading services don't exhaust the connection pool. It also
re-exports everything from `@prisma/client`, so enums like `ReportReason` come
from `@cougny/db` directly.

```ts
import { prisma, ReportReason } from '@cougny/db';
```

## Data model

Deliberately small for the MVP; accounts can be added later without reshaping
these tables.

### `Session`

A call session: the pseudonymous identity a call runs on. Created before a
user's first call and attached to the account that created it via `userId`.
Stores only coarse abuse-mitigation metadata: **hashed** IP, user agent, locale.

### `Call`

One matched 1:1 pairing. Media is P2P — only metadata is persisted: `roomId`,
the two participant sessions (`peerA` / `peerB`), timing, and an
`endReason` (`SKIPPED` | `DISCONNECTED` | `REPORTED` | `ERROR`).

### `Report`

A moderation report filed by one session against another, linked to a `Call`.
Carries a `reason` (`NUDITY` | `HARASSMENT` | `MINOR` | `SPAM` | `OTHER`) and a
`status` (`OPEN` | `REVIEWING` | `ACTIONED` | `DISMISSED`).

```
Session ──< Call >── Session
   │          │
   └──< Report >──┘   (reporter, reported, and the call)
```

## Workflow

```bash
pnpm db:generate     # regenerate the client after schema changes
pnpm db:migrate      # create/apply a dev migration
pnpm db:studio       # browse data in Prisma Studio
# deploy:
pnpm --filter @cougny/db migrate:deploy
```

`DATABASE_URL` is read from the root `.env`. See
[infrastructure.md](../infrastructure.md#postgres).

> The client must be generated (`pnpm db:generate`) before the API or `db`
> package will type-check — CI runs this step before lint/typecheck.

## Account models

Added alongside the call layer; the two meet at `Session.userId`.

| Model          | Holds                                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`         | The account: email, Argon2id password digest, handle, date of birth (`@db.Date`), ISO country, role, status, and the `termsAcceptedAt` / `conductAcceptedAt` attestations |
| `Passkey`      | A WebAuthn credential — public key, signature counter, transports, and whether it is device-bound or synced                                                               |
| `OAuthAccount` | A Google or Discord identity, keyed on the provider's immutable subject id                                                                                                |
| `AuthSession`  | One signed-in device. Holds a SHA-256 of the refresh token and a `familyId` shared by every rotation of that login                                                        |
| `AuthToken`    | Single-use, expiring emailed tokens for verification and password reset, stored hashed                                                                                    |
| `AuthAuditLog` | Append-only trail of security-relevant events                                                                                                                             |

Three things are deliberate:

- **Nothing usable is stored in the clear.** Passwords are Argon2id digests;
  refresh and email tokens are stored as SHA-256 verifiers; a passkey row holds
  only a public key. A dump of these tables lets an attacker authenticate as
  nobody.
- **`profileCompletedAt` gates the account.** A social sign-up arrives with no
  date of birth and no country, so it stays incomplete — and unable to create a
  call session — until its holder supplies them.
- **Deleting a `User` cascades to its auth rows but not to call history.**
  `Session.userId` is `SetNull`, so reports and call records survive: they are
  evidence about other people too, and erasing them on request would be a way to
  launder a moderation history.
