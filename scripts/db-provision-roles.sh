#!/usr/bin/env bash
# Create — or rotate the passwords of — the cougny_migrator and cougny_app
# roles against whichever database PROVISION_DATABASE_URL points at.
#
# This is the out-of-band step that has to happen before `prisma migrate deploy`
# can run as cougny_migrator; see packages/db/sql/provision-roles.sql for why it
# cannot be a migration.
#
#   dev (Neon)   doppler run -- pnpm db:provision
#   production   handled by the db-provision compose service, not this script
#
# Connects as the bootstrap owner (neondb_owner on Neon, POSTGRES_USER on the
# droplet) — the only identity permitted to CREATE ROLE.
set -euo pipefail

: "${PROVISION_DATABASE_URL:?set it to the bootstrap-owner connection string (Neon: the neondb_owner URL)}"
: "${POSTGRES_MIGRATOR_PASSWORD:?generate with \`openssl rand -hex 24\`}"
: "${POSTGRES_APP_PASSWORD:?generate with \`openssl rand -hex 24\`}"

if ! command -v psql >/dev/null; then
  echo "psql not found. Install the PostgreSQL client (macOS: brew install libpq)." >&2
  exit 1
fi

SQL="$(cd "$(dirname "$0")/.." && pwd)/packages/db/sql/provision-roles.sql"

# The two passwords are fed in over stdin rather than as `--set` arguments:
# anything on psql's argv is world-readable in `ps` for as long as it runs.
# Single quotes are doubled because they close psql's own quoting.
quote() { printf "%s" "${1//\'/\'\'}"; }

{
  printf "\\set migrator_password '%s'\n" "$(quote "$POSTGRES_MIGRATOR_PASSWORD")"
  printf "\\set app_password '%s'\n" "$(quote "$POSTGRES_APP_PASSWORD")"
  cat "$SQL"
} | psql "$PROVISION_DATABASE_URL" --quiet --no-psqlrc --set=ON_ERROR_STOP=1
