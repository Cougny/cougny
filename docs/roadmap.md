# Roadmap & Deferred Work

The MVP foundation is intentionally lean but built with the seams needed to grow.
This tracks what's deliberately deferred and where it plugs in.

## Scaling the realtime tier

- **Redis-backed matchmaking.** Replace the in-process
  [`Matchmaker`](../apps/signaling/src/matchmaker.ts) with a Redis ZSET queue so
  multiple signaling instances share one pool. The `Hub` interface stays the
  same.
- **Cross-instance signal fan-out.** Use Redis pub/sub so two peers matched on
  different signaling instances can still relay to each other.
- **Sticky vs. stateless sockets.** Decide load-balancer strategy once signaling
  is horizontally scaled.

## Media

- **SFU for group calls.** For anything beyond 1:1 (rooms, spectators), add a
  self-hosted SFU (mediasoup / LiveKit). 1:1 stays pure P2P.
- **TURN capacity planning.** Monitor the share of TURN-relayed calls; scale
  coturn horizontally behind a shared secret.

## Safety & moderation

- ~~**Rate limiting & abuse throttling** — join spam, report spam, reconnect
  storms.~~ Done: `@fastify/rate-limit` on the API (Redis-shared when
  `REDIS_URL` is set) and per-connection token buckets on signaling. Remaining:
  Redis-backed signaling limits for multi-instance deployments.
- ~~**Server-side validation of report participants.**~~ Done: the hub persists
  every match as a `Call` row and `POST /v1/reports` verifies both parties
  against it.
- **Moderator dashboard** over the `Report` queue; session bans.
- **Automated content moderation** and **age assurance**.

## Product

- **Interests / locale matching UI** — the protocol already carries
  `MatchPreferences` and the matchmaker already pairs on shared interests;
  expose it in the web client. (Gender is the only preference surfaced today;
  country/interests controls were pulled back out pending real matching.)
- ~~**In-call report flow.**~~ Done: flag button → reason dialog →
  `POST /v1/reports`, then auto-skip.
- ~~**Reconnection UX.**~~ Done: transient ICE drops get a grace period and one
  ICE restart before "peer left".
- **Accounts (optional)** — the `Session` model can gain an optional `User`
  relation without reshaping existing tables.

## Platform

- **Mobile app (React Native)** — deferred at MVP; would consume the same
  `@cougny/protocol` contracts.
- **Additional locales** — add `messages/<locale>.json` and a negotiation step
  in [`src/i18n/request.ts`](../apps/web/src/i18n/request.ts).
- **Observability** — structured logs (pino) and Prometheus `/metrics` on both
  services exist; still open: tracing, dashboards, and alerting.
- **E2E tests** — Playwright against two browser contexts to exercise a full
  match→connect→next cycle.
