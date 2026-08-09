#!/usr/bin/env bash
# Install the nightly database backup timer on the production host.
# Run as root, once, after the first deploy has populated /opt/cougny:
#
#   sudo bash /opt/cougny/scripts/install-backup-timer.sh
#
# Idempotent: re-run it after changing either unit file to pick up the edit.
# The backup script itself (scripts/db-backup.sh) is synced by every deploy, so
# changes there need no reinstall.
set -euo pipefail

APP_DIR=/opt/cougny
UNIT_DIR=/etc/systemd/system

[ "$(id -u)" -eq 0 ] || {
  echo "Run as root: sudo bash $0" >&2
  exit 1
}

for unit in cougny-backup.service cougny-backup.timer; do
  src="$APP_DIR/infra/$unit"
  [ -f "$src" ] || {
    echo "Missing $src — run a deploy first so the unit files are on the host." >&2
    exit 1
  }
  install -m 644 "$src" "$UNIT_DIR/$unit"
  echo "installed $UNIT_DIR/$unit"
done

install -d -o deploy -g deploy "$APP_DIR/backups"

systemctl daemon-reload
systemctl enable --now cougny-backup.timer

echo
systemctl list-timers cougny-backup.timer --no-pager || true
echo
echo "Take one now to prove it works end to end:"
echo "  sudo -u deploy $APP_DIR/scripts/db-backup.sh"
