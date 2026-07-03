# Deployment

How Cougny runs in production: a single host (written for a DigitalOcean
droplet, any Ubuntu box with a public IP works), deployed **continuously from
GitHub Actions** — CI builds every app image, pushes to GHCR, then rolls the
host over SSH. The server never builds anything.

The stack is defined in
[`docker-compose.prod.yml`](../docker-compose.prod.yml):

```
                        ┌──────────────────────── host ───────────────────────────┐
  https://cougny.com ──────► Caddy ──► web (Next.js :3000)                         │
  https://api.cougny.com ──► (TLS) ──► api (Fastify :4000) ──► postgres, redis    │
  wss://signaling.cougny.com ────────► signaling (ws :4001) ──► postgres          │
  turn:turn.cougny.com:3478 ─────────► coturn (host network, UDP relay range)     │
                        └──────────────────────────────────────────────────────────┘

  www.cougny.com is a redirect to the apex (cougny.com); see DNS below.

  push to main ──► GitHub Actions ──► build images ──► GHCR ──► ssh deploy@host:
                                                                pull → migrate → up
```

- **Caddy** terminates TLS with automatic Let's Encrypt certificates and
  reverse-proxies the three apps. HTTPS is not optional: browsers refuse
  camera/microphone access (`getUserMedia`) on insecure origins.
- **postgres** and **redis** are only reachable on the internal Docker network.
- **coturn** uses host networking so ICE candidates carry real addresses.
- **Doppler** injects every runtime secret on the host — no `.env` files exist
  in production.
- **CI deploys as the unprivileged `deploy` user**, pulls prebuilt images by
  commit SHA, runs `prisma migrate deploy`, then restarts the stack.

## 1. Prerequisites

- A domain with DNS you control (examples below use `cougny.com`).
- A [Doppler](https://www.doppler.com) workplace.
- An Ubuntu 24.04 host with a public IP. 2 GB RAM is enough — images are
  built in CI, never on the host (the bootstrap script adds swap regardless).

## 2. DNS

`cougny.com` is the primary domain; `www` redirects to it. Create `A` records
pointing at the host's public IPv4 (and `AAAA` for IPv6 if you enable it):

| Record                 | Purpose                     |
| ---------------------- | --------------------------- |
| `cougny.com` (apex)    | Web client (Caddy)          |
| `api.cougny.com`       | HTTP API (Caddy)            |
| `signaling.cougny.com` | WebSocket signaling (Caddy) |
| `turn.cougny.com`      | STUN/TURN (coturn, direct)  |

Let's Encrypt issuance requires the first three to resolve before the stack
starts. `turn.cougny.com` needs no certificate in the default setup — see
[TURN over TLS](#turn-over-tls).

> **Cloudflare users:** create the four records above as **DNS only** (grey
> cloud), not Proxied. Cloudflare cannot proxy TURN's UDP traffic, and its
> proxy TLS conflicts with Caddy's ACME issuance.
>
> The `www` → apex redirect is handled at Cloudflare's edge, so `www` is the
> one exception: add a **Proxied** `A` record for `www` (any valid IP — it's
> never contacted), then a **Redirect Rule**: match `https://www.*`, redirect
> to `https://${1}` (301, preserve query string). A Redirect Rule only fires
> on proxied hostnames, which is why `www` must be orange while everything
> else is grey.

## 3. Bootstrap the host

As root on the fresh host, run
[`scripts/droplet-bootstrap.sh`](../scripts/droplet-bootstrap.sh) with the CI
deploy **public** key (the counterpart of the `DEPLOY_SSH_KEY` secret) as its
argument:

```bash
bash droplet-bootstrap.sh 'ssh-ed25519 AAAA... cougny-ci-deploy'
```

Idempotent; it installs Docker + Doppler, creates the unprivileged `deploy`
user CI connects as, opens the firewall (SSH, 80, 443 tcp+udp, 3478 tcp+udp,
relay range 49160–49400/udp — Postgres and Redis are never exposed), adds
2 GB swap if the host has none, and disables SSH password authentication.

## 4. Configure Doppler

Create a project (e.g. `cougny`) with a production config (e.g. `prd`) and set
the secrets below — `doppler secrets set` or the dashboard, either works.

### Required secrets

| Secret                      | Example / how to generate                |
| --------------------------- | ---------------------------------------- |
| `POSTGRES_PASSWORD`         | `openssl rand -hex 24`                   |
| `AUTH_JWT_SECRET`           | `openssl rand -hex 32`                   |
| `TURN_STATIC_AUTH_SECRET`   | `openssl rand -hex 32`                   |
| `TURN_REALM`                | `cougny.com`                             |
| `STUN_URL`                  | `stun:turn.cougny.com:3478`              |
| `TURN_URL`                  | `turn:turn.cougny.com:3478`              |
| `SIGNALING_ALLOWED_ORIGINS` | `https://cougny.com`                     |
| `WEB_DOMAIN`                | `cougny.com`                             |
| `API_DOMAIN`                | `api.cougny.com`                         |
| `SIGNALING_DOMAIN`          | `signaling.cougny.com`                   |
| `ACME_EMAIL`                | `ops@cougny.com` (Let's Encrypt contact) |

### Optional (defaults shown)

| Secret                | Default  | Purpose                            |
| --------------------- | -------- | ---------------------------------- |
| `POSTGRES_USER`       | `cougny` | Database role                      |
| `POSTGRES_DB`         | `cougny` | Database name                      |
| `TURN_CREDENTIAL_TTL` | `86400`  | Minted TURN credential TTL (s)     |
| `TURN_MIN_PORT`       | `49160`  | Relay range lower bound            |
| `TURN_MAX_PORT`       | `49400`  | Relay range upper bound            |
| `SIGNALING_MAX_QUEUE` | `10000`  | Matchmaking queue backpressure cap |

Then authenticate the host with a **service token** scoped to that config
(read-only, revocable — never use a personal token on a server). The token
belongs to the `deploy` user, scoped to the app directory:

```bash
# Dashboard: project → config → Access → Generate Service Token
sudo -u deploy doppler configure set token 'dp.st.prd.XXXX' --scope /opt/cougny
```

## 5. Configure GitHub

The [Deploy workflow](../.github/workflows/deploy.yml) needs one secret and
four variables (repo **Settings → Secrets and variables → Actions**):

| Kind     | Name                        | Value                                     |
| -------- | --------------------------- | ----------------------------------------- |
| secret   | `DEPLOY_SSH_KEY`            | Private key for the `deploy` user         |
| variable | `DEPLOY_HOST`               | Host IP, e.g. `165.227.83.125`            |
| variable | `DEPLOY_USER`               | `deploy`                                  |
| variable | `NEXT_PUBLIC_API_URL`       | `https://api.cougny.com` (build-time)     |
| variable | `NEXT_PUBLIC_SIGNALING_URL` | `wss://signaling.cougny.com` (build-time) |

Generate the deploy keypair with
`ssh-keygen -t ed25519 -N '' -C cougny-ci-deploy`; the private key becomes the
secret, the public key goes to the bootstrap script (§3).

The host's SSH public key is pinned in
[`infra/known_hosts`](../infra/known_hosts) — CI refuses to connect to
anything else. If the host is ever rebuilt, re-run
`ssh-keyscan -t ed25519 <ip> > infra/known_hosts` and commit.

The `NEXT_PUBLIC_*` values are plain variables, not secrets: they are public
URLs inlined into the client JavaScript bundle at image build time.

## 6. Deploy

Every push to `main` triggers the
[Deploy workflow](../.github/workflows/deploy.yml) (or run it manually via
**Actions → Deploy → Run workflow**):

1. **build** — all four images (`web`, `api`, `signaling`, `migrate`) are
   built and pushed to GHCR, tagged `latest` and with the commit SHA.
2. **deploy** — over SSH as `deploy`: sync `docker-compose.prod.yml` +
   `Caddyfile` to `/opt/cougny`, pull the SHA-tagged images, run
   `prisma migrate deploy` (migrations run **before** the new containers
   start), then `docker compose up -d`.

Compose only recreates containers whose image or config changed, so a deploy
that touches one service restarts one service. To roll back, re-run the
Deploy workflow from the last good commit in the Actions UI.

## 7. Verify

```bash
ssh deploy@<host> 'docker compose -f /opt/cougny/docker-compose.prod.yml ps'
curl -fsS https://api.cougny.com/healthz              # {"status":"ok",...}
curl -fsS -o /dev/null -w '%{http_code}\n' https://cougny.com       # 200
```

Then open the web client in two browsers (or a browser and a phone off-wifi
to exercise TURN) and confirm a call connects.

## Manual deploy (fallback)

The host can also run the stack without CI — useful before the first
workflow run or if Actions is down. As `deploy` on the host:

```bash
cd /opt/cougny
doppler run -- docker compose -f docker-compose.prod.yml --profile tools pull
doppler run -- docker compose -f docker-compose.prod.yml run --rm --no-build db-migrate
doppler run -- docker compose -f docker-compose.prod.yml up -d --no-build
```

(Requires a `docker login ghcr.io` with a token that can read packages while
the repository is private.) Building on the host instead of pulling also
works: drop `--no-build` and add `--build` — the compose file keeps its
`build:` sections for exactly this.

## <a id="turn-over-tls"></a>TURN over TLS (optional hardening)

The default config serves plain `turn:`/`stun:` on 3478. This is the standard
production coturn deployment: call media is always end-to-end encrypted
(DTLS-SRTP) regardless of TURN transport, and credentials are ephemeral HMACs.

TURN-over-TLS (`turns:` on 5349/tcp) helps clients behind restrictive
corporate firewalls that only pass TLS. To enable it:

1. Obtain a certificate for `turn.cougny.com` (e.g. `certbot certonly
--standalone -d turn.cougny.com` — port 80 must be free momentarily, or use
   DNS-01).
2. Mount the cert/key into the coturn service and replace `--no-tls
--no-dtls` with `--cert=/etc/coturn/tls/fullchain.pem
--pkey=/etc/coturn/tls/privkey.pem --tls-listening-port=5349`.
3. Open 5349/tcp in the firewall and add `turns:turn.cougny.com:5349` handling
   to the API's ICE response.
4. Restart coturn after each renewal (certs are read at startup).

## Backups

The only system of record is Postgres (`pgdata` volume). Two cheap options,
use at least one:

- **Droplet snapshots** — whole-machine, point-in-time, via the DO panel.
- **Logical dumps** — cron a `pg_dump` and ship it off-host:

  ```bash
  docker compose -f docker-compose.prod.yml exec -T postgres \
    pg_dump -U cougny -Fc cougny > "cougny-$(date +%F).dump"
  ```

Redis is ephemeral by design and needs no backup.

## Troubleshooting

| Symptom                             | Check                                                                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Deploy workflow fails at SSH        | `DEPLOY_SSH_KEY` secret matches the public key in `/home/deploy/.ssh/authorized_keys`; `infra/known_hosts` matches the host. |
| Deploy fails at `doppler run`       | The Doppler service token isn't configured for the `deploy` user with `--scope /opt/cougny` (§4).                            |
| Site unreachable / cert errors      | `docker compose logs caddy` — DNS must resolve to the host before ACME can issue.                                            |
| `up` fails with "required variable" | The named secret is missing in the Doppler config.                                                                           |
| Calls connect on wifi, fail on LTE  | TURN problem: relay range open in firewall? `TURN_URL` resolves to the host? `docker compose logs coturn`.                   |
| Camera prompt never appears         | Page not on HTTPS — check you're hitting Caddy, not a raw port.                                                              |
| API/signaling unhealthy             | `docker compose logs api signaling` — usually a bad `DATABASE_URL` or unapplied migrations.                                  |
