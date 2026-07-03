#!/usr/bin/env bash
# One-time production host bootstrap for Cougny (Ubuntu 24.04).
# Run as root:  bash droplet-bootstrap.sh '<ci-deploy-public-key>'
#
# Idempotent: safe to re-run. Installs Docker + Doppler, creates the
# unprivileged `deploy` user CI connects as, opens exactly the ports the
# stack needs, and adds swap on small droplets.
#
# After this script, two manual steps remain (see docs/deployment.md):
#   1. Configure the Doppler service token as the deploy user.
#   2. Point DNS at this host and run the Deploy workflow.
set -euo pipefail

CI_PUBKEY="${1:?usage: droplet-bootstrap.sh '<ci-deploy-public-key>'}"

export DEBIAN_FRONTEND=noninteractive

echo "==> Base packages"
apt-get update -q
apt-get install -yq ca-certificates curl ufw

echo "==> Docker Engine + Compose plugin"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

echo "==> Doppler CLI"
if ! command -v doppler >/dev/null; then
  curl -Ls --tlsv1.2 --proto "=https" --retry 3 https://cli.doppler.com/install.sh | sh
fi

echo "==> deploy user (unprivileged; docker group only)"
if ! id deploy >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash deploy
fi
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
grep -qxF "$CI_PUBKEY" /home/deploy/.ssh/authorized_keys 2>/dev/null ||
  echo "$CI_PUBKEY" >>/home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

echo "==> App directory"
install -d -o deploy -g deploy /opt/cougny /opt/cougny/infra

echo "==> Firewall (matches docs/deployment.md)"
ufw allow OpenSSH
ufw allow 80/tcp    # ACME challenges, HTTP->HTTPS redirect
ufw allow 443/tcp   # HTTPS
ufw allow 443/udp   # HTTP/3
ufw allow 3478/tcp  # STUN/TURN
ufw allow 3478/udp
ufw allow 49160:49400/udp # TURN relay range (TURN_MIN_PORT..TURN_MAX_PORT)
ufw --force enable

echo "==> Swap (2G, only if the host has none)"
if [ "$(swapon --show --noheadings | wc -l)" -eq 0 ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -qF '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi

echo "==> SSH hardening: key-only auth"
# OpenSSH uses the FIRST value it reads, and cloud-init often drops a
# `PasswordAuthentication yes` into 50-cloud-init.conf — so this override must
# sort before every other conf file (00- prefix), and we verify the effective
# config with `sshd -T` rather than trusting any single file.
printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\n' \
  >/etc/ssh/sshd_config.d/00-cougny-hardening.conf
systemctl reload ssh
# (grep without -q: -q exits at first match, SIGPIPE-ing sshd — under
# pipefail that reports failure even when the setting is correct.)
if ! sshd -T | grep -x 'passwordauthentication no' >/dev/null; then
  echo 'ERROR: password authentication is still enabled' >&2
  exit 1
fi

echo
echo "Bootstrap complete. Remaining manual steps:"
echo "  1. sudo -u deploy doppler configure set token '<service-token>' --scope /opt/cougny"
echo "  2. Point DNS at this host, set the GitHub secrets/vars, run the Deploy workflow."
