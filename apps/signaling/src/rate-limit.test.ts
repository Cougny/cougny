import { describe, expect, it } from 'vitest';
import { TokenBucket } from './rate-limit.js';

describe('TokenBucket', () => {
  it('allows a burst up to capacity, then rejects', () => {
    const now = 1_000_000;
    const bucket = new TokenBucket(3, 1, now);

    expect(bucket.tryConsume(now)).toBe(true);
    expect(bucket.tryConsume(now)).toBe(true);
    expect(bucket.tryConsume(now)).toBe(true);
    expect(bucket.tryConsume(now)).toBe(false);
  });

  it('refills continuously over time', () => {
    const now = 1_000_000;
    const bucket = new TokenBucket(2, 1, now);
    bucket.tryConsume(now);
    bucket.tryConsume(now);
    expect(bucket.tryConsume(now)).toBe(false);

    // Half a second refills half a token — still not enough.
    expect(bucket.tryConsume(now + 500)).toBe(false);
    // Two full seconds later there is at least one token again.
    expect(bucket.tryConsume(now + 2_000)).toBe(true);
  });

  it('never accumulates beyond capacity', () => {
    const now = 1_000_000;
    const bucket = new TokenBucket(2, 10, now);

    // A long quiet period must not bank more than `capacity` tokens.
    const later = now + 60_000;
    expect(bucket.tryConsume(later)).toBe(true);
    expect(bucket.tryConsume(later)).toBe(true);
    expect(bucket.tryConsume(later)).toBe(false);
  });

  it('is monotonic even if the clock jumps backwards', () => {
    const now = 1_000_000;
    const bucket = new TokenBucket(1, 1, now);
    bucket.tryConsume(now);
    expect(bucket.tryConsume(now - 10_000)).toBe(false);
  });
});
