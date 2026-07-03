/**
 * Continuous-refill token bucket. Each action costs one token; the bucket
 * refills at `refillPerSecond` up to `capacity`, so short bursts (ICE
 * candidate storms, quick skips) pass while sustained flooding is rejected.
 */
export class TokenBucket {
  private tokens: number;
  private lastRefillAt: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    now: number = Date.now(),
  ) {
    this.tokens = capacity;
    this.lastRefillAt = now;
  }

  /** Consume one token if available. Returns false when rate-limited. */
  tryConsume(now: number = Date.now()): boolean {
    this.refill(now);
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }

  private refill(now: number): void {
    const elapsedSeconds = Math.max(0, now - this.lastRefillAt) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSeconds * this.refillPerSecond);
    this.lastRefillAt = now;
  }
}
