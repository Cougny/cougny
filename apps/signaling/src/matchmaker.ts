import type { MatchPreferences } from '@cougny/protocol';

export interface WaitingPeer {
  id: string;
  /** Session behind the connection — used to avoid pairing someone with themselves. */
  sessionId: string;
  preferences: MatchPreferences;
  enqueuedAt: number;
}

/**
 * Outcome of an {@link Matchmaker.enqueue} call:
 * - `matched`  — paired with a waiting peer; neither remains queued.
 * - `waiting`  — added to (or already in) the pool, awaiting a partner.
 * - `rejected` — the pool is at capacity; the peer was not queued.
 */
export type EnqueueResult =
  | { status: 'matched'; match: { a: string; b: string } }
  | { status: 'waiting' }
  | { status: 'rejected'; reason: 'full' };

/** Default cap on simultaneously-waiting peers; overridable per instance. */
export const DEFAULT_MAX_WAITING = 10_000;

/**
 * FIFO matchmaker for 1:1 random pairing.
 *
 * The interface (enqueue → result, remove, size) is deliberately narrow and
 * free of any transport concern, so it is trivially unit-testable and can be
 * swapped for a Redis/ZSET-backed implementation when scaling to multiple
 * signaling instances — the hub does not need to change.
 *
 * The waiting pool is bounded by `maxWaiting`: once it is full, new peers that
 * cannot be paired immediately are rejected rather than accumulating without
 * limit, so a flood of unmatchable peers cannot exhaust memory.
 */
export class Matchmaker {
  private readonly waiting: WaitingPeer[] = [];

  constructor(private readonly maxWaiting: number = DEFAULT_MAX_WAITING) {}

  /**
   * Add a peer to the pool. If a compatible partner is already waiting, returns
   * `matched` immediately (and neither remains queued). If the peer is already
   * waiting, or is newly added, returns `waiting`. If no partner is available
   * and the pool is at capacity, returns `rejected` without queuing the peer.
   */
  enqueue(id: string, sessionId: string, preferences: MatchPreferences = {}): EnqueueResult {
    // Re-enqueuing an already-waiting peer is idempotent, not a new admission,
    // so it never counts against capacity.
    if (this.waiting.some((p) => p.id === id)) return { status: 'waiting' };

    const partnerIndex = this.findPartnerIndex(sessionId, preferences);
    if (partnerIndex !== -1) {
      const [partner] = this.waiting.splice(partnerIndex, 1);
      return { status: 'matched', match: { a: partner!.id, b: id } };
    }

    if (this.waiting.length >= this.maxWaiting) return { status: 'rejected', reason: 'full' };

    this.waiting.push({ id, sessionId, preferences, enqueuedAt: Date.now() });
    return { status: 'waiting' };
  }

  /** Remove a peer from the waiting pool (on leave/disconnect). */
  remove(id: string): void {
    const index = this.waiting.findIndex((p) => p.id === id);
    if (index !== -1) this.waiting.splice(index, 1);
  }

  /** Zero-based position in the queue, or -1 if not waiting. */
  positionOf(id: string): number {
    return this.waiting.findIndex((p) => p.id === id);
  }

  get size(): number {
    return this.waiting.length;
  }

  /**
   * Pick the longest-waiting compatible peer. Compatibility today is: not the
   * same session (two tabs of one browser must never match each other), and —
   * if both sides declared interests — at least one shared interest.
   * Locale/interest weighting can grow here without touching callers.
   */
  private findPartnerIndex(sessionId: string, preferences: MatchPreferences): number {
    for (let i = 0; i < this.waiting.length; i += 1) {
      const candidate = this.waiting[i]!;
      if (candidate.sessionId === sessionId) continue;
      if (this.isCompatible(preferences, candidate.preferences)) return i;
    }
    return -1;
  }

  private isCompatible(a: MatchPreferences, b: MatchPreferences): boolean {
    const aInterests = a.interests ?? [];
    const bInterests = b.interests ?? [];
    if (aInterests.length === 0 || bInterests.length === 0) return true;
    return aInterests.some((interest) => bInterests.includes(interest));
  }
}
