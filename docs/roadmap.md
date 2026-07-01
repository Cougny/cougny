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

- **Rate limiting & abuse throttling** (Redis) — join spam, report spam,
  reconnect storms.
- **Server-side validation of report participants** — verify the reported id
  actually shared the room (see
  [security-and-moderation.md](./security-and-moderation.md#known-gaps-open-work)).
- **Moderator dashboard** over the `Report` queue; session bans.
- **Automated content moderation** and **age assurance**.

## Product

- **Interests / locale matching UI** — the protocol already carries
  `MatchPreferences`; expose it in the web client.
- **In-call report flow** — wire the report UI (strings already in
  `messages/en.json`) to `POST /v1/reports`.
- **Reconnection UX** — auto-retry on transient ICE failures before showing
  "peer left".
- **Accounts (optional)** — the `Session` model can gain an optional `User`
  relation without reshaping existing tables.

## Platform

- **Mobile app (React Native)** — deferred at MVP; would consume the same
  `@cougny/protocol` contracts.
- **Additional locales** — add `messages/<locale>.json` and a negotiation step
  in [`src/i18n/request.ts`](../apps/web/src/i18n/request.ts).
- **Observability** — structured logs exist (pino); add metrics/tracing and
  dashboards.
- **E2E tests** — Playwright against two browser contexts to exercise a full
  match→connect→next cycle.
