import { createHmac } from 'node:crypto';
import { describe, expect, it, beforeAll } from 'vitest';

describe('mintIceServers', () => {
  beforeAll(() => {
    process.env.AUTH_JWT_SECRET = 'test-secret-at-least-16-chars';
    process.env.TURN_STATIC_AUTH_SECRET = 'test-turn-secret';
  });

  it('produces a coturn-compatible HMAC credential that expires in the future', async () => {
    const { mintIceServers } = await import('./turn.js');
    const now = 1_700_000_000_000;
    const result = mintIceServers('session-123', now);

    expect(result.expiresAt).toBeGreaterThan(Math.floor(now / 1000));

    const turn = result.iceServers.find((s) => String(s.urls).startsWith('turn:'));
    expect(turn?.username).toBe(`${result.expiresAt}:session-123`);

    const expected = createHmac('sha1', 'test-turn-secret')
      .update(turn!.username!)
      .digest('base64');
    expect(turn?.credential).toBe(expected);
  });
});
