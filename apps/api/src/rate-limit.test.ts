import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

vi.mock('@cougny/db', () => ({
  prisma: {
    session: { create: vi.fn().mockResolvedValue({ id: 'session-x' }) },
    call: { findUnique: vi.fn() },
    report: { create: vi.fn() },
  },
  ReportReason: {
    NUDITY: 'NUDITY',
    HARASSMENT: 'HARASSMENT',
    MINOR: 'MINOR',
    SPAM: 'SPAM',
    OTHER: 'OTHER',
  },
}));

const ROUTE_LIMIT = 10; // POST /v1/sessions per IP per minute

describe('rate limiting', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_JWT_SECRET = 'test-secret-at-least-16-chars';
    process.env.TURN_STATIC_AUTH_SECRET = 'test-turn-secret';

    const { buildApp } = await import('./app.js');
    app = await buildApp();
  });

  it('throttles session creation with a 429 and the standard error envelope', async () => {
    let last: { statusCode: number; body: string } | null = null;
    for (let i = 0; i < ROUTE_LIMIT + 1; i += 1) {
      last = await app.inject({ method: 'POST', url: '/v1/sessions' });
      if (i < ROUTE_LIMIT) expect(last.statusCode).toBe(200);
    }

    expect(last!.statusCode).toBe(429);
    const payload = JSON.parse(last!.body) as { error: { code: string }; statusCode?: number };
    expect(payload.error.code).toBe('rate_limited');
    // The serializer must strip the internal statusCode from the envelope.
    expect(payload.statusCode).toBeUndefined();
  });
});
