import { Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Prometheus metrics for the HTTP API, served on `GET /metrics`. Route labels
 * use the route pattern (`/v1/reports`), never the raw URL, to keep
 * cardinality bounded.
 */
export const registry = new Registry();

collectDefaultMetrics({ register: registry });

export const httpRequestDurationSeconds = new Histogram({
  name: 'cougny_api_http_request_duration_seconds',
  help: 'HTTP request duration by method, route pattern, and status code.',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [registry],
});
