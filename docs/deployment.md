# Deployment

How to run the full Cougny stack on a single host — written for a DigitalOcean
droplet, but any Ubuntu box with a public IP works the same way.

The production stack is defined in
[`docker-compose.prod.yml`](../docker-compose.prod.yml):

```
                        ┌──────────────────────── droplet ────────────────────────┐
  https://www.cougny.com ──► Caddy ──► web (Next.js :3000)                        │
  https://api.cougny.com ──► (TLS) ──► api (Fastify :4000) ──► postgres, redis    │
  wss://signaling.cougny.com ────────► signaling (ws :4001) ──► postgres          │
  turn:turn.cougny.com:3478 ─────────► coturn (host network, UDP relay range)     │
                        └──────────────────────────────────────────────────────────┘
```

- **Caddy** terminates TLS with automatic Let's Encrypt certificates and
  reverse-proxies the three apps. HTTPS is not optional: browsers refuse
  camera/microphone access (`getUserMedia`) on insecure origins.
- **postgres** and **redis** are only reachable on the internal Docker network.
- **coturn** uses host networking so ICE candidates carry real addresses.
- **Doppler** injects every secret and config value — no `.env` files exist on
  the server.

## 1. Prerequisites

- A domain with DNS you control (examples below use `cougny.com`).
- A [Doppler](https://www.doppler.com) workplace.
- A droplet: Ubuntu 24.04 LTS, **4 GB RAM recommended** (the Next.js image
  build is memory-hungry; on 2 GB add swap first).

## 2. DNS

Create `A` records pointing at the droplet's public IPv4 (and `AAAA` for IPv6
if you enable it):

| Record                 | Purpose                     |
| ---------------------- | --------------------------- |
| `www.cougny.com`       | Web client (Caddy)          |
| `api.cougny.com`       | HTTP API (Caddy)            |
| `signaling.cougny.com` | WebSocket signaling (Caddy) |
| `turn.cougny.com`      | STUN/TURN (coturn, direct)  |

Let's Encrypt issuance requires the first three to resolve before the stack
starts. `turn.cougny.com` needs no certificate in the default setup — see
[TURN over TLS](#turn-over-tls).

## 3. Install Docker and Doppler on the droplet

```bash
# Docker Engine + Compose plugin (official repository)
curl -fsSL https://get.docker.com | sh

# Doppler CLI
curl -Ls --tlsv1.2 --proto "=https" --retry 3 https://cli.doppler.com/install.sh | sh
```

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
| `SIGNALING_ALLOWED_ORIGINS` | `https://www.cougny.com`                 |
| `NEXT_PUBLIC_API_URL`       | `https://api.cougny.com`                 |
| `NEXT_PUBLIC_SIGNALING_URL` | `wss://signaling.cougny.com`             |
| `WEB_DOMAIN`                | `www.cougny.com`                         |
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

Then authenticate the droplet with a **service token** scoped to that config
(read-only, revocable — never use a personal token on a server):

```bash
# Dashboard: project → config → Access → Generate Service Token
export HISTIGNORE='doppler*'   # keep the token out of shell history
doppler configure set token 'dp.st.prd.XXXX' --scope /opt/cougny
```

## 5. Firewall

Open only what the edge needs (DigitalOcean Cloud Firewall or `ufw`):

| Port(s)     | Proto   | Purpose                     |
| ----------- | ------- | --------------------------- |
| 22          | tcp     | SSH                         |
| 80          | tcp     | ACME challenges, HTTP→HTTPS |
| 443         | tcp+udp | HTTPS (+ HTTP/3)            |
| 3478        | tcp+udp | STUN/TURN                   |
| 49160–49400 | udp     | TURN relay range            |

The relay range must match `TURN_MIN_PORT`/`TURN_MAX_PORT`. Postgres (5432)
and Redis (6379) are **not** published and must not be opened.

## 6. First deploy

```bash
git clone https://github.com/Cougny/cougny.git /opt/cougny
cd /opt/cougny

# Build images and start the stack (Doppler injects all ${VAR} values)
doppler run -- docker compose -f docker-compose.prod.yml up -d --build

# Apply database migrations (first run and after any schema change)
doppler run -- docker compose -f docker-compose.prod.yml run --rm db-migrate
```

Caddy obtains certificates on first start; allow a few seconds after `up`
before the sites answer.

## 7. Verify

```bash
docker compose -f docker-compose.prod.yml ps          # all services healthy
curl -fsS https://api.cougny.com/healthz              # {"status":"ok",...}
curl -fsS -o /dev/null -w '%{http_code}\n' https://www.cougny.com   # 200
```

Then open the web client in two browsers (or a browser and a phone off-wifi to
exercise TURN) and confirm a call connects.

## 8. Updating

```bash
cd /opt/cougny
git pull
doppler run -- docker compose -f docker-compose.prod.yml up -d --build
# Only needed when packages/db/prisma/migrations changed:
doppler run -- docker compose -f docker-compose.prod.yml run --rm db-migrate
docker image prune -f   # reclaim space from superseded image layers
```

Compose only recreates containers whose image or config changed. Changing any
`NEXT_PUBLIC_*` secret requires a rebuild (`--build`) because those values are
inlined into the client bundle at build time.

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

| Symptom                             | Check                                                                                                             |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Site unreachable / cert errors      | `docker compose -f docker-compose.prod.yml logs caddy` — DNS must resolve to the droplet before ACME can issue.   |
| `up` fails with "required variable" | The named secret is missing in Doppler, or the command wasn't run through `doppler run`.                          |
| Calls connect on wifi, fail on LTE  | TURN problem: relay range open in firewall? `TURN_URL` resolves to the droplet? `docker compose ... logs coturn`. |
| Camera prompt never appears         | Page not on HTTPS — check you're hitting Caddy, not a raw port.                                                   |
| API/signaling unhealthy             | `docker compose ... logs api signaling` — usually a bad `DATABASE_URL` or unapplied migrations.                   |
