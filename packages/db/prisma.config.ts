import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 configuration. As of v7 the connection URL lives here (used by
 * migration/introspection commands) instead of in `schema.prisma`; the runtime
 * client connects through a driver adapter — see `src/index.ts`.
 *
 * `DATABASE_URL` is loaded from this package's `.env` via `dotenv/config`.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
    /**
     * Scratch database Prisma replays the migration history into when it needs
     * to know what the schema *should* look like — drift detection and
     * `migrate diff --from-migrations`. Optional: when unset, Prisma creates and
     * drops a temporary database on the same server.
     */
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
