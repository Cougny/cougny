import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

const findUnique = vi.fn();
const create = vi.fn();

vi.mock('@cougny/db', () => ({
  prisma: {
    call: { findUnique },
    report: { create },
  },
  ReportReason: {
    NUDITY: 'NUDITY',
    HARASSMENT: 'HARASSMENT',
    MINOR: 'MINOR',
    SPAM: 'SPAM',
    OTHER: 'OTHER',
  },
}));

const CALL = { id: 'call-1', peerAId: 'session-a', peerBId: 'session-b' };

describe('POST /v1/reports', () => {
  let app: FastifyInstance;
  let tokenA: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_JWT_SECRET = 'test-secret-at-least-16-chars';
    process.env.TURN_STATIC_AUTH_SECRET = 'test-turn-secret';

    const { buildApp } = await import('../app.js');
    const { signSessionToken } = await import('../tokens.js');
    app = await buildApp();
    tokenA = signSessionToken('session-a').token;
  });

  const post = (body: Record<string, unknown>, token?: string) =>
    app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body,
    });

  const validBody = {
    roomId: 'room-1',
    reportedPeerId: 'session-b',
    reason: 'harassment',
  };

  it('rejects requests without a session token', async () => {
    const res = await post(validBody);
    expect(res.statusCode).toBe(401);
  });

  it('404s for a room that never existed', async () => {
    findUnique.mockResolvedValueOnce(null);
    const res = await post(validBody, tokenA);
    expect(res.statusCode).toBe(404);
  });

  it('403s when the reporter was not a participant of the call', async () => {
    findUnique.mockResolvedValueOnce({ ...CALL, peerAId: 'someone-else' });
    const res = await post(validBody, tokenA);
    expect(res.statusCode).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it('403s when the reported id is not the other peer of the call', async () => {
    findUnique.mockResolvedValueOnce(CALL);
    const res = await post({ ...validBody, reportedPeerId: 'session-c' }, tokenA);
    expect(res.statusCode).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a report when reporter and reported shared the room', async () => {
    findUnique.mockResolvedValueOnce(CALL);
    create.mockResolvedValueOnce({ id: 'report-1' });

    const res = await post({ ...validBody, details: 'context' }, tokenA);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ reportId: 'report-1' });
    expect(create).toHaveBeenCalledWith({
      data: {
        callId: 'call-1',
        reporterId: 'session-a',
        reportedId: 'session-b',
        reason: 'HARASSMENT',
        details: 'context',
      },
      select: { id: true },
    });
  });
});
