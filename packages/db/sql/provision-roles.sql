-- Provision the two application database roles.
--
--   cougny_migrator  owns every object in `public` and is the only role that
--                    may run DDL. `prisma migrate deploy` connects as this.
--   cougny_app       may only read and write rows. The API and signaling
--                    services connect as this, so a compromised app process
--                    cannot drop, alter, or truncate anything.
--
-- This is deliberately NOT a Prisma migration. Migrations run *as*
-- cougny_migrator, which has no CREATE ROLE privilege, so it cannot be the
-- thing that creates itself. Provisioning runs first, as the bootstrap owner:
--
--   self-hosted (droplet)  the POSTGRES_USER superuser
--   Neon (dev)             neondb_owner, via its neon_superuser membership
--
-- Idempotent: safe to re-run on every deploy, and re-running is also how the
-- two passwords get rotated.
--
-- Requires two psql variables — see scripts/db-provision-roles.sh:
--   :migrator_password  :app_password

\set ON_ERROR_STOP on

BEGIN;

-- 1. The roles themselves. -----------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'cougny_migrator') THEN
    CREATE ROLE cougny_migrator LOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'cougny_app') THEN
    CREATE ROLE cougny_app LOGIN;
  END IF;
END
$$;

-- Set unconditionally, so a re-run rotates the passwords. Kept at the top level
-- rather than inside the DO block above: psql does not interpolate its
-- variables inside dollar-quoted strings.
ALTER ROLE cougny_migrator PASSWORD :'migrator_password';
ALTER ROLE cougny_app PASSWORD :'app_password';

-- Handing ownership to a role requires membership in it. The bootstrap owner is
-- a superuser only on the droplet; on Neon it is not, so make the membership
-- explicit and portable.
GRANT cougny_migrator, cougny_app TO CURRENT_USER;

DO $$
BEGIN
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO cougny_migrator, cougny_app',
    current_database()
  );
  -- CREATE on the *database* means "may create schemas", which the migrator
  -- needs for a reason that is easy to miss: Prisma's baseline migration opens
  -- with `CREATE SCHEMA IF NOT EXISTS "public"`, and PostgreSQL runs the
  -- privilege check before IF NOT EXISTS gets to short-circuit. Without this,
  -- `migrate deploy` fails on 0_init with a bare "permission denied for
  -- database" even though the schema plainly already exists.
  EXECUTE format(
    'GRANT CREATE ON DATABASE %I TO cougny_migrator',
    current_database()
  );
END
$$;

-- 2. Schema privileges. --------------------------------------------------------
-- Only the migrator may create objects. PostgreSQL 15+ already revokes CREATE
-- from PUBLIC on the `public` schema, but older clusters restored into a newer
-- one can carry the old grant, so be explicit.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO cougny_migrator;
GRANT USAGE ON SCHEMA public TO cougny_app;

-- 3. Adopt objects that already exist. -----------------------------------------
-- On an established database every table, sequence and enum is still owned by
-- the bootstrap role. The migrator cannot ALTER what it does not own, so the
-- next migration would fail without this. A fresh database skips the loops.
DO $$
DECLARE
  rel record;
BEGIN
  FOR rel IN
    SELECT c.relname, c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'S', 'v', 'm')
      AND c.relowner <> 'cougny_migrator'::regrole
  LOOP
    EXECUTE format(
      CASE rel.relkind
        WHEN 'S' THEN 'ALTER SEQUENCE public.%I OWNER TO cougny_migrator'
        WHEN 'v' THEN 'ALTER VIEW public.%I OWNER TO cougny_migrator'
        WHEN 'm' THEN 'ALTER MATERIALIZED VIEW public.%I OWNER TO cougny_migrator'
        ELSE 'ALTER TABLE public.%I OWNER TO cougny_migrator'
      END,
      rel.relname
    );
  END LOOP;
END
$$;

-- Prisma renders every schema enum as a real PostgreSQL type, and adding a
-- variant is an ALTER TYPE — so these need the same ownership transfer.
DO $$
DECLARE
  typ record;
BEGIN
  FOR typ IN
    SELECT t.typname
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typtype = 'e'
      AND t.typowner <> 'cougny_migrator'::regrole
  LOOP
    EXECUTE format('ALTER TYPE public.%I OWNER TO cougny_migrator', typ.typname);
  END LOOP;
END
$$;

-- 4. What the app role may do to those objects. --------------------------------
-- Rows only: no CREATE, no ALTER, no DROP, no TRUNCATE.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cougny_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cougny_app;

-- `_prisma_migrations` is Prisma's own bookkeeping, not application data. The
-- blanket grant above would otherwise let a compromised app process delete rows
-- from it, which is enough to make the next deploy replay migrations over a
-- populated database. Nothing but the migrator has any business touching it.
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    REVOKE ALL ON TABLE public."_prisma_migrations" FROM cougny_app;
  END IF;
END
$$;

-- 5. And to objects future migrations create. ----------------------------------
-- ALTER DEFAULT PRIVILEGES only applies to objects created *after* it runs, and
-- only to those created by the named role — hence FOR ROLE cougny_migrator, and
-- hence step 4 above still being necessary for what already exists.
ALTER DEFAULT PRIVILEGES FOR ROLE cougny_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cougny_app;
ALTER DEFAULT PRIVILEGES FOR ROLE cougny_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO cougny_app;

COMMIT;
