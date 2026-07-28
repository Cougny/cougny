import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createDbDouble } from './test/db-double.js';

/** A complete, active account — enough for the guard to let a request through. */
const USER = {
  id: 'user-1',
  email: 'ada@example.com',
  username: 'ada',
  displayName: 'Ada',
  passwordHash: null,
  dateOfBirth: new Date('1990-06-15T00:00:00Z'),
  country: 'GB',
  role: 'USER',
  status: 'ACTIVE',
  profileCompletedAt: new Date(),
  createdAt: new Date(),
};

vi.mock('@cougny/db', () =>
  createDbDouble({
    prisma: {
      session: { create: vi.fn().mockResolvedValue({ id: 'session-x' }) },
      authSession: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: 'auth-session-1', userId: 'user-1', user: USER }),
        update: vi.fn().mockResolvedValue({}),
      },
    },
  }),
);

const ROUTE_LIMIT = 10; // POST /v1/sessions per IP per minute

describe('rate limiting', () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_JWT_SECRET = 'test-secret-at-least-16-chars';
    process.env.TURN_STATIC_AUTH_SECRET = 'test-turn-secret';

    const { buildApp } = await import('./app.js');
    const { signAccessToken } = await import('./auth/tokens.js');
    app = await buildApp();
    // Creating a call session requires an account, so the throttling this test
    // is about only becomes observable once the request is authorized.
    token = signAccessToken('user-1', 'auth-session-1').token;
  });

  it('throttles session creation with a 429 and the standard error envelope', async () => {
    let last: { statusCode: number; body: string } | null = null;
    for (let i = 0; i < ROUTE_LIMIT + 1; i += 1) {
      last = await app.inject({
        method: 'POST',
        url: '/v1/sessions',
        headers: { authorization: `Bearer ${token}` },
      });
      if (i < ROUTE_LIMIT) expect(last.statusCode).toBe(200);
    }

    expect(last!.statusCode).toBe(429);
    const payload = JSON.parse(last!.body) as { error: { code: string }; statusCode?: number };
    expect(payload.error.code).toBe('rate_limited');
    // The serializer must strip the internal statusCode from the envelope.
    expect(payload.statusCode).toBeUndefined();
  });

  it('refuses to create a call session without an account', async () => {
    // Its own source address: the test above deliberately exhausted the limit
    // for the default one, and a 429 here would prove nothing about auth.
    const res = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      remoteAddress: '10.1.0.1',
    });

    expect(res.statusCode).toBe(401);
  });
});
