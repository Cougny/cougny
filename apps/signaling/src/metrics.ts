import { Counter, Gauge, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Prometheus metrics for the signaling tier, served on `GET /metrics` by the
 * same HTTP server that answers `/healthz`. Gauges observe live state lazily
 * via `collect`, so nothing here needs to be kept in sync by hand.
 */
export const registry = new Registry();

collectDefaultMetrics({ register: registry });

export const matchesTotal = new Counter({
  name: 'cougny_signaling_matches_total',
  help: 'Total number of 1:1 pairings made by the matchmaker.',
  registers: [registry],
});

export const messagesTotal = new Counter({
  name: 'cougny_signaling_messages_total',
  help: 'Inbound client frames by message type.',
  labelNames: ['type'] as const,
  registers: [registry],
});

export const rateLimitedTotal = new Counter({
  name: 'cougny_signaling_rate_limited_total',
  help: 'Inbound frames dropped by per-connection rate limiting.',
  registers: [registry],
});

export const queueRejectedTotal = new Counter({
  name: 'cougny_signaling_queue_rejected_total',
  help: 'Join attempts rejected because the matchmaking queue was at capacity.',
  registers: [registry],
});

export const rejectedHandshakesTotal = new Counter({
  name: 'cougny_signaling_rejected_handshakes_total',
  help: 'WebSocket upgrades rejected at the handshake.',
  labelNames: ['reason'] as const,
  registers: [registry],
});

/** Register gauges that read live hub state at scrape time. */
export function observeHub(hub: { connectionCount: number; queueSize: number }): void {
  new Gauge({
    name: 'cougny_signaling_connections',
    help: 'Currently open WebSocket connections.',
    registers: [registry],
    collect(): void {
      this.set(hub.connectionCount);
    },
  });

  new Gauge({
    name: 'cougny_signaling_queue_size',
    help: 'Peers currently waiting in the matchmaking queue.',
    registers: [registry],
    collect(): void {
      this.set(hub.queueSize);
    },
  });
}
