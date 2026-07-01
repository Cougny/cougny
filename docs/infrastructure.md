# Infrastructure

Local infrastructure is defined in
[`infra/docker-compose.yml`](../infra/docker-compose.yml) and started with:

```bash
pnpm infra:up      # docker compose up -d
pnpm infra:down    # docker compose down
```

Compose reads the repo-root `.env`, so credentials stay in one place.

## Services

| Service  | Image                      | Port(s)                           | Purpose                                                           |
| -------- | -------------------------- | --------------------------------- | ----------------------------------------------------------------- |
| postgres | `postgres:18-alpine`       | 5432                              | Sessions, calls, reports. Volume `pgdata`.                        |
| redis    | `redis:8-alpine`           | 6379                              | Provisioned for presence/rate-limiting/scale-out (not yet wired). |
| coturn   | `coturn/coturn:4.6-alpine` | 3478 (tcp/udp), 49160–49200 (udp) | STUN/TURN for NAT traversal.                                      |

### Postgres

Configured via `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`. A
healthcheck (`pg_isready`) gates readiness. Data persists in the `pgdata`
volume; `docker compose down -v` wipes it.

### Redis

Started with persistence disabled (`--save '' --appendonly no`) — it's a cache/
coordination layer, not a system of record. See [roadmap.md](./roadmap.md) for
what will use it (Redis-backed matchmaking, rate limiting, cross-instance
signaling fan-out).

### <a id="coturn"></a>coturn

Runs in REST-API credential mode:

```
--use-auth-secret
--static-auth-secret=${TURN_STATIC_AUTH_SECRET}
--realm=cougny.local
--min-port=49160 --max-port=49200
--no-tls --no-dtls          # local dev only
```

The API mints matching HMAC credentials — see
[webrtc.md](./webrtc.md#ice--turn-credentials).

**Production notes:**

- Terminate TLS/DTLS (drop `--no-tls --no-dtls`, supply certs) and expose `5349`.
- Give coturn a public IP / `--external-ip` mapping; TURN relaying needs
  reachable UDP ports.
- Rotate `TURN_STATIC_AUTH_SECRET` and keep it only in the API and coturn.

## Environment matrix

| Variable                    | postgres | redis | coturn | api | signaling | web |
| --------------------------- | :------: | :---: | :----: | :-: | :-------: | :-: |
| `DATABASE_URL`              |          |       |        |  ✓  |           |     |
| `REDIS_URL`                 |          |   ✓   |        |     |           |     |
| `AUTH_JWT_SECRET`           |          |       |        |  ✓  |           |     |
| `TURN_STATIC_AUTH_SECRET`   |          |       |   ✓    |  ✓  |           |     |
| `STUN_URL` / `TURN_URL`     |          |       |        |  ✓  |           |     |
| `SIGNALING_ALLOWED_ORIGINS` |          |       |        |  ✓  |     ✓     |     |
| `NEXT_PUBLIC_API_URL`       |          |       |        |     |           |  ✓  |
| `NEXT_PUBLIC_SIGNALING_URL` |          |       |        |     |           |  ✓  |

## Deploying the apps

Each app builds to a standalone artifact:

- **api / signaling** — `pnpm --filter @cougny/<app> build` → `node dist/index.js`.
  Both expose `GET /healthz` for load-balancer probes.
- **web** — `next build` → `next start` (or a static/edge deploy).

Run database migrations on deploy with `pnpm --filter @cougny/db migrate:deploy`.
