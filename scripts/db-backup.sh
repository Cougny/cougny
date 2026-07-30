#!/usr/bin/env bash
# Take one database backup, prune old ones, and ship the new one off the host.
# Runs on the production host as the `deploy` user, driven by a systemd timer
# (infra/cougny-backup.timer). Safe to run by hand at any time.
#
#   cd /opt/cougny && ./scripts/db-backup.sh
#
# Off-host is the part that matters. A dump sitting in /opt/cougny/backups
# survives a bad migration or a dropped table, but not the droplet dying — and
# the droplet is the thing that holds the only copy of the database. When
# BACKUP_S3_BUCKET is unset this script still works, still keeps local dumps,
# and warns loudly on every run, because half a backup strategy tends to be
# mistaken for a whole one.
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

cd "$(dirname "$0")/.."

mkdir -p "$BACKUP_DIR"

echo "==> Dumping database"
doppler run --preserve-env -- docker compose -f "$COMPOSE_FILE" run --rm db-backup </dev/null

newest="$(find "$BACKUP_DIR" -name 'cougny-*.dump' -type f -print0 |
  xargs -0 ls -t 2>/dev/null | head -1)"
if [ -z "$newest" ]; then
  echo "ERROR: no dump was produced" >&2
  exit 1
fi
echo "==> Newest dump: $newest"

# A dump that cannot be read back is not a backup. pg_restore --list parses the
# archive's table of contents without touching a database, which is enough to
# catch a truncated or corrupt file here rather than during an incident.
echo "==> Verifying archive is readable"
docker run --rm -v "$(cd "$BACKUP_DIR" && pwd)":/backups:ro postgres:18-alpine \
  pg_restore --list "/backups/$(basename "$newest")" >/dev/null
echo "    ok"

if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  echo "==> Uploading to s3://$BACKUP_S3_BUCKET"
  # Run the CLI in a container so the host needs nothing installed. Works with
  # any S3-compatible store — Cloudflare R2 (region `auto`, endpoint
  # https://<account-id>.r2.cloudflarestorage.com) or DigitalOcean Spaces
  # (e.g. https://fra1.digitaloceanspaces.com).
  #
  # The two checksum settings matter for anything that is not AWS. From v2.23
  # the CLI computes a CRC32 integrity header on every upload by default, and
  # S3-compatible providers that do not implement it reject the request. Asking
  # for checksums only `when_required` restores the older behaviour. Harmless
  # against real S3, so it is set unconditionally rather than per-provider.
  docker run --rm \
    -v "$(cd "$BACKUP_DIR" && pwd)":/backups:ro \
    -e AWS_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY_ID:?set it alongside BACKUP_S3_BUCKET}" \
    -e AWS_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_ACCESS_KEY:?set it alongside BACKUP_S3_BUCKET}" \
    -e AWS_DEFAULT_REGION="${BACKUP_S3_REGION:-auto}" \
    -e AWS_REQUEST_CHECKSUM_CALCULATION=when_required \
    -e AWS_RESPONSE_CHECKSUM_VALIDATION=when_required \
    amazon/aws-cli:latest \
    s3 cp "/backups/$(basename "$newest")" "s3://$BACKUP_S3_BUCKET/$(basename "$newest")" \
    ${BACKUP_S3_ENDPOINT:+--endpoint-url "$BACKUP_S3_ENDPOINT"}
  echo "    uploaded"
else
  echo "WARNING: BACKUP_S3_BUCKET is unset — this backup exists only on this" >&2
  echo "         host. Losing the droplet loses the database. See" >&2
  echo "         docs/deployment.md#backups." >&2
fi

echo "==> Pruning local dumps older than ${RETENTION_DAYS}d"
# -mtime +N is strictly older than N days, so nothing is deleted on the same day
# it is written even when the timer fires more than once.
find "$BACKUP_DIR" -name 'cougny-*.dump' -type f -mtime "+${RETENTION_DAYS}" -print -delete
# Interrupted dumps never become eligible for the check above, so clear them on
# age alone.
find "$BACKUP_DIR" -name 'cougny-*.dump.partial' -type f -mtime +1 -print -delete

echo "==> Done. $(find "$BACKUP_DIR" -name 'cougny-*.dump' -type f | wc -l | tr -d ' ') dump(s) retained locally."
